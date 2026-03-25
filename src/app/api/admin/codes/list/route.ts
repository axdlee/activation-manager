import { NextResponse } from 'next/server'

import { createProtectedAdminRouteHandler } from '@/lib/admin-route-handler'
import { prisma } from '@/lib/db'

export const GET = createProtectedAdminRouteHandler(
  async () => {
    const codes = await prisma.activationCode.findMany({
      include: {
        project: {
          select: {
            id: true,
            name: true,
            projectKey: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({
      success: true,
      codes,
    })
  },
  {
    logLabel: '获取激活码列表时发生错误',
    errorStatus: 500,
    errorMessage: '服务器内部错误',
  },
)
