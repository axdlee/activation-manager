import bcrypt from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'

import { resolveCookieSecure } from '@/lib/cookie-secure'
import { extractClientIp } from '@/lib/admin-auth-service'
import {
  adminLoginRateLimiter,
  type AsyncAdminLoginRateLimiter,
} from '@/lib/admin-login-rate-limit'
import { MissingRequiredSystemConfigError } from '@/lib/config-service'
import { prisma } from '@/lib/db'
import { recordAdminOperationAuditLog } from '@/lib/admin-operation-audit-service'
import { getJwtSessionCookieMaxAge } from '@/lib/jwt-session'
import { signToken } from '@/lib/jwt'
import { resolveServerLocale, serverT } from '@/lib/i18n/server'

function createRateLimitedResponse(retryAfterSeconds: number, message: string) {
  return NextResponse.json(
    {
      success: false,
      message,
      retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSeconds),
      },
    },
  )
}

export const adminLoginRouteDependencies: {
  rateLimiter: AsyncAdminLoginRateLimiter
} = {
  rateLimiter: adminLoginRateLimiter,
}

// 限流表按时间清理：登录时每小时触发一次，删除 24 小时未更新的行，
// 避免失败计数/锁定记录在数据库里无限累积
const RATE_LIMIT_SWEEP_INTERVAL_MS = 60 * 60 * 1000
const RATE_LIMIT_ROW_RETENTION_MS = 24 * 60 * 60 * 1000
let lastRateLimitSweepAt = 0

export function maybeSweepAdminLoginRateLimitStore(
  now = Date.now(),
  client: Pick<typeof prisma, 'adminLoginRateLimitState'> = prisma,
) {
  if (now - lastRateLimitSweepAt < RATE_LIMIT_SWEEP_INTERVAL_MS) {
    return
  }
  lastRateLimitSweepAt = now
  void client.adminLoginRateLimitState
    .deleteMany({
      where: { updatedAt: { lt: new Date(now - RATE_LIMIT_ROW_RETENTION_MS) } },
    })
    .catch(() => undefined)
}

async function createInvalidCredentialsResponse(keys: string[], message: string) {
  // 失败计数同时落在 IP 与用户名两个维度：只按 IP 计数时，攻击者可
  // 通过轮换 X-Forwarded-For 重置计数；叠加用户名维度后，针对同一账号
  // 的爆破即使换 IP 也会被锁定。
  for (const key of keys) {
    await adminLoginRouteDependencies.rateLimiter.recordFailure(key)
  }

  return NextResponse.json({ success: false, message }, { status: 401 })
}

export async function handleAdminLoginRequest(request: NextRequest) {
  const t = serverT(resolveServerLocale(request))

  try {
    const { username, password } = await request.json()
    const clientIp = extractClientIp(request)

    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: t('auth.credentialsRequired') },
        { status: 400 },
      )
    }

    const rateLimitResult = await adminLoginRouteDependencies.rateLimiter.check(clientIp)
    if (!rateLimitResult.allowed) {
      return createRateLimitedResponse(
        rateLimitResult.retryAfterSeconds,
        t('auth.loginRateLimited'),
      )
    }

    // 按用户名维度的第二道限流：同一账号无论来源 IP 如何轮换，失败
    // 次数达到阈值后同样锁定。
    // 注意：用户名维度锁定只拦「继续试错」，不能拦「正确凭据」——
    // 否则外部攻击者换 IP 错输 5 次即可把真实管理员永久锁在门外
    // （登录接口不受 IP 白名单保护，属于可远程触发的 DoS）。因此
    // 锁定时仍照常校验密码：密码正确 → 正常放行并重置计数；
    // 密码错误 → 返回 429（不消耗额外信息，也不暴露账号是否存在）。
    const usernameRateLimitKey = `username:${String(username)}`
    const usernameRateLimitResult =
      await adminLoginRouteDependencies.rateLimiter.check(usernameRateLimitKey)
    const usernameLocked = !usernameRateLimitResult.allowed

    const admin = await prisma.admin.findUnique({
      where: { username },
    })

    if (!admin) {
      // 用户名维度已锁定时，不存在的账号同样以 429 响应，避免通过
      // 401/429 差异探测账号是否存在
      if (usernameLocked) {
        return createRateLimitedResponse(
          usernameRateLimitResult.retryAfterSeconds,
          t('auth.loginRateLimited'),
        )
      }
      return await createInvalidCredentialsResponse([clientIp, usernameRateLimitKey], t('auth.loginFailed'))
    }

    maybeSweepAdminLoginRateLimitStore()

    const isValid = await bcrypt.compare(password, admin.password)
    if (!isValid) {
      if (usernameLocked) {
        return createRateLimitedResponse(
          usernameRateLimitResult.retryAfterSeconds,
          t('auth.loginRateLimited'),
        )
      }
      return await createInvalidCredentialsResponse([clientIp, usernameRateLimitKey], t('auth.loginFailed'))
    }

    await adminLoginRouteDependencies.rateLimiter.reset(clientIp)
    await adminLoginRouteDependencies.rateLimiter.reset(usernameRateLimitKey)

    const token = await signToken({ username, isAdmin: true, tokenVersion: admin.tokenVersion })
    const sessionCookieMaxAge = await getJwtSessionCookieMaxAge()

    await recordAdminOperationAuditLog(prisma, {
      adminUsername: username,
      operationType: 'ADMIN_LOGIN',
      targetLabel: username,
      detail: {
        clientIp,
      },
    })

    const response = NextResponse.json({
      success: true,
      message: t('auth.loginSuccess'),
    })

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: resolveCookieSecure(request),
      sameSite: 'strict',
      maxAge: sessionCookieMaxAge,
    })

    return response
  } catch (error) {
    console.error('登录时发生错误:', error)

    if (error instanceof MissingRequiredSystemConfigError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 },
      )
    }

    return NextResponse.json(
      { success: false, message: t('api.internalError') },
      { status: 500 },
    )
  }
}
