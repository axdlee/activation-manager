import bcrypt from 'bcryptjs'
import { NextResponse, type NextRequest } from 'next/server'

import { createProtectedAdminRouteHandler } from '@/lib/admin-route-handler'
import { type AdminAuthSuccessResult } from '@/lib/admin-auth-shared'
import { resolveServerLocale, serverT } from '@/lib/i18n/server'
import { prisma } from '@/lib/db'
import { getConfigWithDefault } from '@/lib/config-service'
import { recordAdminOperationAuditLog } from '@/lib/admin-operation-audit-service'
import { signToken } from '@/lib/jwt'
import { getJwtSessionCookieMaxAge } from '@/lib/jwt-session'
import { resolveCookieSecure } from '@/lib/cookie-secure'

export const POST = createProtectedAdminRouteHandler(
  async (request: NextRequest, authResult: AdminAuthSuccessResult) => {
    const t = serverT(resolveServerLocale(request))
    const { currentPassword, newPassword } = await request.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        {
          success: false,
          message: t('password.fieldsRequired'),
        },
        { status: 400 },
      )
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        {
          success: false,
          message: t('password.minLength'),
        },
        { status: 400 },
      )
    }

    const admin = await prisma.admin.findUnique({
      where: { username: authResult.payload?.username },
    })

    if (!admin) {
      return NextResponse.json(
        {
          success: false,
          message: t('password.adminNotFound'),
        },
        { status: 404 },
      )
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, admin.password)
    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        {
          success: false,
          message: t('password.currentIncorrect'),
        },
        { status: 400 },
      )
    }

    const bcryptRounds = await getConfigWithDefault('bcryptRounds')
    const newPasswordHash = await bcrypt.hash(newPassword, bcryptRounds)

    // tokenVersion 自增使所有旧令牌立即失效；随后签发带新版本号的
    // 令牌写回 Cookie，当前会话无感续期，其他已登录会话全部踢出
    const updatedAdmin = await prisma.admin.update({
      where: { id: admin.id },
      data: { password: newPasswordHash, tokenVersion: { increment: 1 } },
    })
    const newToken = await signToken({
      username: updatedAdmin.username,
      isAdmin: true,
      tokenVersion: updatedAdmin.tokenVersion,
    })

    await recordAdminOperationAuditLog(prisma, {
      adminUsername: authResult.payload?.username ?? 'unknown',
      operationType: 'PASSWORD_CHANGED',
      projectId: null,
      targetLabel: authResult.payload?.username,
    })

    const response = NextResponse.json({
      success: true,
      message: t('password.changed'),
    })

    response.cookies.set('auth-token', newToken, {
      httpOnly: true,
      secure: resolveCookieSecure(request),
      sameSite: 'strict',
      maxAge: await getJwtSessionCookieMaxAge(),
    })

    return response
  },
  {
    logLabel: '密码修改失败',
    errorStatus: 500,
    errorMessageKey: 'password.changeFailed',
  },
)
