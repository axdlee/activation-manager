import { NextRequest, NextResponse } from 'next/server'
import { type AdminAuthResult } from './lib/admin-auth-shared'
import {
  buildAdminAuthValidationUrl,
  resolveAdminPageAuthMode,
  resolveAdminPageGuardAction,
  resolveAdminAuthValidationOrigin,
} from './lib/admin-page-guard'

function normalizeAdminAuthStatus(status: number): 401 | 403 | 500 {
  if (status === 401 || status === 403) {
    return status
  }

  return 500
}

async function validateAdminPageRequest(request: NextRequest, mode: 'public' | 'protected') {
  const validationOrigin = resolveAdminAuthValidationOrigin(request.url, {
    internalOrigin: process.env.INTERNAL_ADMIN_AUTH_ORIGIN,
    runtimePort: process.env.PORT,
  })
  const validationUrl = buildAdminAuthValidationUrl(request.url, mode, validationOrigin)
  // 原样转发原始 X-Forwarded-For / X-Real-IP：内部校验跳与边缘 API 采用同一
  // 份链路数据，extractClientIp 在两侧按同一套 TRUSTED_PROXY_COUNT 计数规则
  // 解析，避免二次解析破坏「从右往左数可信代理」的取位。原请求没有 XFF 时
  // 不发送该头，让内部跳同样走「无头→本机 socket/兜底」的默认分支。
  const validationHeaders: Record<string, string> = {
    cookie: request.headers.get('cookie') || '',
    'x-real-ip': request.headers.get('x-real-ip') || '',
    // 进程随机密钥头（v2.11.0 评审·高危 2）：server.js 启动时生成
    // LICENSE_INTERNAL_XFF_SECRET 并对回环 socket + 匹配密钥的连接豁免 XFF
    // 追加。env 值由 server.js 在 require('next') 之前写入，middleware 运行时
    // 可读（已实测验证）；dev 模式（next dev，无 server.js）下为空值，
    // 服务端比对必然失败 → 回环跳退化为照常追加，方向安全。
    'x-internal-xff-secret': process.env.LICENSE_INTERNAL_XFF_SECRET || '',
  }
  const rawForwardedFor = request.headers.get('x-forwarded-for')
  if (rawForwardedFor) {
    validationHeaders['x-forwarded-for'] = rawForwardedFor
  }

  try {
    const response = await fetch(validationUrl, {
      method: 'GET',
      headers: validationHeaders,
      cache: 'no-store',
    })

    const result = (await response.json()) as AdminAuthResult

    if (!result.success && response.status !== result.status) {
      return {
        success: false,
        code: 'auth_failed',
        error: result.error,
        status: normalizeAdminAuthStatus(response.status),
      } satisfies AdminAuthResult
    }

    return result
  } catch (error) {
    console.error('后台访问校验失败:', error)
    return {
      success: false,
      code: 'auth_failed',
      error: '后台访问校验失败',
      status: 500,
    } satisfies AdminAuthResult
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const mode = resolveAdminPageAuthMode(pathname)
  if (!mode) {
    return NextResponse.next()
  }

  const result = await validateAdminPageRequest(request, mode)
  const action = resolveAdminPageGuardAction(mode, result, request.url)

  if (action.type === 'redirect') {
    return NextResponse.redirect(new URL(action.location))
  }

  if (action.type === 'response') {
    return new NextResponse(action.message, {
      status: action.status,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
      },
    })
  }

  const response = NextResponse.next()
  response.headers.set('x-middleware-cache', 'no-cache')
  return response
}

export const config = {
  matcher: ['/admin/:path*']
}
