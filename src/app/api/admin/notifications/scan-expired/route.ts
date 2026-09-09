import { NextResponse, type NextRequest } from 'next/server'

import { createProtectedAdminRouteHandler } from '@/lib/admin-route-handler'
import { resolveServerLocale, serverT } from '@/lib/i18n/server'
import { scanExpiredActivationCodes } from '@/lib/license-expiry-scan-service'
import { recordAdminOperationAuditLog } from '@/lib/admin-operation-audit-service'
import { prisma } from '@/lib/db'

/**
 * 手动触发到期通知扫描。
 * 管理员在后台点击，或外部 cron 定时调用：
 *   curl -X POST -b "auth-token=<cookie>" /api/admin/notifications/scan-expired
 */
export const POST = createProtectedAdminRouteHandler(
  async (request: NextRequest, authResult) => {
    const t = serverT(resolveServerLocale(request))
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
      message: t('notify.scanResult', { scanned, notified }),
    })
  },
  { logLabel: 'scan-expired-notifications' },
)
