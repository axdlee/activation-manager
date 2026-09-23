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
    // 次数达到阈值后同样锁定
    const usernameRateLimitKey = `username:${String(username)}`
    const usernameRateLimitResult =
      await adminLoginRouteDependencies.rateLimiter.check(usernameRateLimitKey)
    if (!usernameRateLimitResult.allowed) {
      return createRateLimitedResponse(
        usernameRateLimitResult.retryAfterSeconds,
        t('auth.loginRateLimited'),
      )
    }

    const admin = await prisma.admin.findUnique({
      where: { username },
    })

    if (!admin) {
      return await createInvalidCredentialsResponse([clientIp, usernameRateLimitKey], t('auth.loginFailed'))
    }

    const isValid = await bcrypt.compare(password, admin.password)
    if (!isValid) {
      return await createInvalidCredentialsResponse([clientIp, usernameRateLimitKey], t('auth.loginFailed'))
    }

    await adminLoginRouteDependencies.rateLimiter.reset(clientIp)
    await adminLoginRouteDependencies.rateLimiter.reset(usernameRateLimitKey)

    const token = await signToken({ username, isAdmin: true })
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
