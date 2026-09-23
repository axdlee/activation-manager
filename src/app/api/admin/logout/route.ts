import { NextResponse, type NextRequest } from 'next/server'

import { resolveServerLocale, serverT } from '@/lib/i18n/server'
import { resolveCookieSecure } from '@/lib/cookie-secure'

export async function POST(request: NextRequest) {
  const t = serverT(resolveServerLocale(request))

  const response = NextResponse.json({
    success: true,
    message: t('auth.logoutSuccess')
  })

  // 清除认证cookie：secure 判定必须与登录一致（resolveCookieSecure）。
  // 若退出时无条件带 Secure 而实际是明文 HTTP，浏览器会拒收删除指令，导致登出失效。
  response.cookies.set('auth-token', '', {
    httpOnly: true,
    secure: resolveCookieSecure(request),
    sameSite: 'strict',
    maxAge: 0
  })

  return response
}
