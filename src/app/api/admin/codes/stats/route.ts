import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, createAuthResponse } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'
import { getActivationCodeStats, listProjectStats } from '@/lib/license-service'

export async function GET(request: NextRequest) {
  try {
    // 使用认证中间件验证
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return createAuthResponse(authResult)
    }

    const [stats, projectStats] = await Promise.all([
      getActivationCodeStats(prisma),
      listProjectStats(prisma),
    ])

    return NextResponse.json({
      success: true,
      stats,
      projectStats,
    })

  } catch (error) {
    console.error('获取统计数据时发生错误:', error)
    return NextResponse.json(
      { success: false, message: '服务器内部错误' },
      { status: 500 }
    )
  }
}
