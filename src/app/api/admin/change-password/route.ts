import bcrypt from 'bcryptjs'
import { NextResponse, type NextRequest } from 'next/server'

import { createProtectedAdminRouteHandler } from '@/lib/admin-route-handler'
import { type AdminAuthSuccessResult } from '@/lib/admin-auth-shared'
import { prisma } from '@/lib/db'
import { getConfigWithDefault } from '@/lib/config-service'

export const POST = createProtectedAdminRouteHandler(
  async (request: NextRequest, authResult: AdminAuthSuccessResult) => {
    const { currentPassword, newPassword } = await request.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        {
          success: false,
          message: '当前密码和新密码不能为空',
        },
        { status: 400 },
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        {
          success: false,
          message: '新密码长度不能少于6位',
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
          message: '管理员账号不存在',
        },
        { status: 404 },
      )
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, admin.password)
    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        {
          success: false,
          message: '当前密码不正确',
        },
        { status: 400 },
      )
    }

    const bcryptRounds = await getConfigWithDefault('bcryptRounds')
    const newPasswordHash = await bcrypt.hash(newPassword, bcryptRounds)

    await prisma.admin.update({
      where: { id: admin.id },
      data: { password: newPasswordHash },
    })

    return NextResponse.json({
      success: true,
      message: '密码修改成功，请重新登录',
    })
  },
  {
    logLabel: '密码修改失败',
    errorStatus: 500,
    errorMessage: '密码修改失败，请重试',
  },
)
