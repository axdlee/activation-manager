import bcrypt from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'

import { config as appConfig } from '@/config'
import { extractClientIp } from '@/lib/admin-auth-service'
import {
  adminLoginRateLimiter,
  type AsyncAdminLoginRateLimiter,
} from '@/lib/admin-login-rate-limit'
import { MissingRequiredSystemConfigError } from '@/lib/config-service'
import { prisma } from '@/lib/db'
import { getJwtSessionCookieMaxAge } from '@/lib/jwt-session'
import { signToken } from '@/lib/jwt'

function createRateLimitedResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    {
      success: false,
      message: '登录失败次数过多，请稍后再试',
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

async function createInvalidCredentialsResponse(clientIp: string) {
  await adminLoginRouteDependencies.rateLimiter.recordFailure(clientIp)

  return NextResponse.json(
    { success: false, message: '用户名或密码错误' },
    { status: 401 },
  )
}

export async function handleAdminLoginRequest(request: NextRequest) {
  try {
    const { username, password } = await request.json()
    const clientIp = extractClientIp(request)

    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: '用户名和密码不能为空' },
        { status: 400 },
      )
    }

    const rateLimitResult = await adminLoginRouteDependencies.rateLimiter.check(clientIp)
    if (!rateLimitResult.allowed) {
      return createRateLimitedResponse(rateLimitResult.retryAfterSeconds)
    }

    const admin = await prisma.admin.findUnique({
      where: { username },
    })

    if (!admin) {
      return await createInvalidCredentialsResponse(clientIp)
    }

    const isValid = await bcrypt.compare(password, admin.password)
    if (!isValid) {
      return await createInvalidCredentialsResponse(clientIp)
    }

    await adminLoginRouteDependencies.rateLimiter.reset(clientIp)

    const token = await signToken({ username, isAdmin: true })
    const sessionCookieMaxAge = await getJwtSessionCookieMaxAge()

    const response = NextResponse.json({
      success: true,
      message: '登录成功',
    })

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: appConfig.server.nodeEnv === 'production',
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
      { success: false, message: '服务器内部错误' },
      { status: 500 },
    )
  }
}
