import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { signToken } from '@/lib/jwt'
import { MissingRequiredSystemConfigError } from '@/lib/config-service'
import { prisma } from '@/lib/db'
import { config as appConfig } from '@/config'
import { getJwtSessionCookieMaxAge } from '@/lib/jwt-session'
import { extractClientIp } from '@/lib/admin-auth-service'
import { adminLoginRateLimiter } from '@/lib/admin-login-rate-limit'

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

function createInvalidCredentialsResponse(clientIp: string) {
  adminLoginRateLimiter.recordFailure(clientIp)

  return NextResponse.json(
    { success: false, message: '用户名或密码错误' },
    { status: 401 }
  )
}

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()
    const clientIp = extractClientIp(request)

    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: '用户名和密码不能为空' },
        { status: 400 }
      )
    }

    const rateLimitResult = adminLoginRateLimiter.check(clientIp)
    if (!rateLimitResult.allowed) {
      return createRateLimitedResponse(rateLimitResult.retryAfterSeconds)
    }

    // 从数据库查找管理员
    const admin = await prisma.admin.findUnique({
      where: { username }
    })

    if (!admin) {
      return createInvalidCredentialsResponse(clientIp)
    }

    // 验证密码
    const isValid = await bcrypt.compare(password, admin.password)
    if (!isValid) {
      return createInvalidCredentialsResponse(clientIp)
    }

    adminLoginRateLimiter.reset(clientIp)

    // 生成JWT token
    const token = await signToken({ username, isAdmin: true })
    const sessionCookieMaxAge = await getJwtSessionCookieMaxAge()

    // 设置httpOnly cookie
    const response = NextResponse.json({
      success: true,
      message: '登录成功'
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
        { status: 500 }
      )
    }

    return NextResponse.json(
      { success: false, message: '服务器内部错误' },
      { status: 500 }
    )
  }
}
