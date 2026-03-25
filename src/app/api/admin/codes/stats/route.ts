import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createProtectedAdminRouteHandler } from '@/lib/admin-route-handler'
import { getActivationCodeStats, listProjectStats } from '@/lib/license-service'

export const GET = createProtectedAdminRouteHandler(
  async () => {
    const [stats, projectStats] = await Promise.all([
      getActivationCodeStats(prisma),
      listProjectStats(prisma),
    ])

    return NextResponse.json({
      success: true,
      stats,
      projectStats,
    })
  },
  {
    logLabel: '获取统计数据时发生错误',
    errorStatus: 500,
    errorMessage: '服务器内部错误',
  },
)
