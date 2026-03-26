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
  const forwardedFor =
    request.ip ||
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    ''

  try {
    const response = await fetch(validationUrl, {
      method: 'GET',
      headers: {
        cookie: request.headers.get('cookie') || '',
        'x-forwarded-for': forwardedFor,
        'x-real-ip': request.headers.get('x-real-ip') || '',
      },
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
