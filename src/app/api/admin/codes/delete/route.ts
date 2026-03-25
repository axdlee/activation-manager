import { NextResponse, type NextRequest } from 'next/server'

import { createProtectedAdminRouteHandler } from '@/lib/admin-route-handler'
import { prisma } from '@/lib/db'

export const DELETE = createProtectedAdminRouteHandler(
  async (request: NextRequest) => {
    const { id } = await request.json()

    if (!id) {
      return NextResponse.json(
        { success: false, message: '激活码ID不能为空' },
        { status: 400 }
      )
    }

    // 检查激活码是否存在
    const existingCode = await prisma.activationCode.findUnique({
      where: { id: parseInt(id) }
    })

    if (!existingCode) {
      return NextResponse.json(
        { success: false, message: '激活码不存在' },
        { status: 404 }
      )
    }

    // 删除激活码
    await prisma.activationCode.delete({
      where: { id: parseInt(id) }
    })

    return NextResponse.json({
      success: true,
      message: '激活码删除成功',
    })
  },
  {
    logLabel: '删除激活码时发生错误',
    errorStatus: 500,
    errorMessage: '服务器内部错误',
  },
)
