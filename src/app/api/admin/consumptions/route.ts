import { NextRequest, NextResponse } from 'next/server'

import { verifyAuth, createAuthResponse } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'
import { listLicenseConsumptions } from '@/lib/license-service'
import { readLicenseConsumptionFilters } from '@/lib/admin-consumption-route-handlers'

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return createAuthResponse(authResult.error || '认证失败', 401)
    }

    const logs = await listLicenseConsumptions(prisma, readLicenseConsumptionFilters(request))

    return NextResponse.json({
      success: true,
      logs,
    })
  } catch (error) {
    console.error('获取消费日志失败:', error)
    const message = error instanceof Error ? error.message : '获取消费日志失败'

    return NextResponse.json(
      { success: false, message },
      { status: 400 },
    )
  }
}
