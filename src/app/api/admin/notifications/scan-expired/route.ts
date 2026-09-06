import { NextResponse, type NextRequest } from 'next/server'

import { createProtectedAdminRouteHandler } from '@/lib/admin-route-handler'
import { scanExpiredActivationCodes } from '@/lib/license-expiry-scan-service'
import { recordAdminOperationAuditLog } from '@/lib/admin-operation-audit-service'
import { prisma } from '@/lib/db'

/**
 * 手动触发到期通知扫描。
 * 管理员在后台点击，或外部 cron 定时调用：
 *   curl -X POST -b "auth-token=<cookie>" /api/admin/notifications/scan-expired
 */
export const POST = createProtectedAdminRouteHandler(
  async (_request: NextRequest, authResult) => {
    const { scanned, notified } = await scanExpiredActivationCodes()

    await recordAdminOperationAuditLog(prisma, {
      adminUsername: authResult.payload?.username ?? 'unknown',
      operationType: 'EXPIRY_NOTIFICATION_SCAN',
      targetLabel: '到期通知扫描',
      detail: { scanned, notified },
    })

    return NextResponse.json({
      success: true,
      scanned,
      notified,
      message: `扫描 ${scanned} 个到期激活码，发送 ${notified} 条通知`,
    })
  },
  { logLabel: 'scan-expired-notifications' },
)
