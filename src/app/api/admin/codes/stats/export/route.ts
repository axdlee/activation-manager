import { NextRequest, NextResponse } from 'next/server'

import { verifyAuth, createAuthResponse } from '@/lib/auth-middleware'
import { handleExportProjectStatsRequest } from '@/lib/admin-project-stats-route-handlers'

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return createAuthResponse(authResult.error || '认证失败', 401)
    }

    return handleExportProjectStatsRequest(request)
  } catch (error) {
    console.error('导出项目统计失败:', error)
    const message = error instanceof Error ? error.message : '导出项目统计失败'

    return NextResponse.json(
      { success: false, message },
      { status: 400 },
    )
  }
}
