import { NextRequest, NextResponse } from 'next/server'

import { verifyAuth, createAuthResponse } from '@/lib/auth-middleware'
import { handleExportLicenseConsumptionsRequest } from '@/lib/admin-consumption-route-handlers'

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return createAuthResponse(authResult.error || '认证失败', 401)
    }

    return handleExportLicenseConsumptionsRequest(request)
  } catch (error) {
    console.error('导出消费日志失败:', error)
    const message = error instanceof Error ? error.message : '导出消费日志失败'

    return NextResponse.json(
      { success: false, message },
      { status: 400 },
    )
  }
}
