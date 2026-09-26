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
import { isClientIpInAdminWhitelist } from '@/lib/admin-auth-service'
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
  /** 锁定期间的来源放行判定：白名单来源才允许完成密码校验 */
  isClientIpWhitelisted: (clientIp: string) => Promise<boolean>
} = {
  rateLimiter: adminLoginRateLimiter,
  isClientIpWhitelisted: isClientIpInAdminWhitelist,
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

async function createLockedInvalidAttemptResponse(
  keys: string[],
  retryAfterSeconds: number,
  message: string,
) {
  // 锁定期间白名单来源的失败尝试同样要计数（v2.11.0 评审·中危 1）：
  // 否则白名单 IP 在锁定窗口内可以无限次试错密码而不延长锁定，锁定
  // 语义被白名单穿透。计数落在 IP + 用户名两维度后，锁定窗口随持续
  // 撞库滚动延长，正确密码的合法管理员仍可随时登录（reset）。
  for (const key of keys) {
    await adminLoginRouteDependencies.rateLimiter.recordFailure(key)
  }

  return createRateLimitedResponse(retryAfterSeconds, message)
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
    // 锁定语义：锁定期间只有「白名单来源」可以继续完成密码校验——
    // 正确密码放行并重置计数（防外部错输几次就把真实管理员远程锁死），
    // 错误密码返回 429。非白名单来源在锁定期间一律 429（即使密码正确）：
    // 否则攻击者轮换可伪造的来源标记即可在锁定状态下持续撞库，用户名
    // 维度限流形同虚设。白名单复用 authorizeAdminRequest 的同一套
    // ALLOWED_IPS 覆盖 / DB 配置 / CIDR 规则（非生产环境恒放行）。
    const usernameRateLimitKey = `username:${String(username)}`
    const usernameRateLimitResult =
      await adminLoginRouteDependencies.rateLimiter.check(usernameRateLimitKey)
    const usernameLocked = !usernameRateLimitResult.allowed

    if (usernameLocked) {
      const sourceWhitelisted =
        await adminLoginRouteDependencies.isClientIpWhitelisted(clientIp)
      if (!sourceWhitelisted) {
        return createRateLimitedResponse(
          usernameRateLimitResult.retryAfterSeconds,
          t('auth.loginRateLimited'),
        )
      }
    }

    const admin = await prisma.admin.findUnique({
      where: { username },
    })

    if (!admin) {
      // 用户名维度已锁定时，不存在的账号同样以 429 响应，避免通过
      // 401/429 差异探测账号是否存在；白名单来源的失败尝试照常计数
      if (usernameLocked) {
        return await createLockedInvalidAttemptResponse(
          [clientIp, usernameRateLimitKey],
          usernameRateLimitResult.retryAfterSeconds,
          t('auth.loginRateLimited'),
        )
      }
      return await createInvalidCredentialsResponse([clientIp, usernameRateLimitKey], t('auth.loginFailed'))
    }

    maybeSweepAdminLoginRateLimitStore()

    const isValid = await bcrypt.compare(password, admin.password)
    if (!isValid) {
      // 锁定期间白名单来源：错误密码 429 且计入失败（不暴露账号是否存在，
      // 同时让锁定窗口随持续撞库滚动延长，见 createLockedInvalidAttemptResponse）
      if (usernameLocked) {
        return await createLockedInvalidAttemptResponse(
          [clientIp, usernameRateLimitKey],
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
