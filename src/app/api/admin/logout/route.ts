import { NextResponse, type NextRequest } from 'next/server'

import { resolveServerLocale, serverT } from '@/lib/i18n/server'

export async function POST(request: NextRequest) {
  const t = serverT(resolveServerLocale(request))

  const response = NextResponse.json({
    success: true,
    message: t('auth.logoutSuccess')
  })

  // 清除认证cookie
  response.cookies.set('auth-token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0
  })

  return response
}
