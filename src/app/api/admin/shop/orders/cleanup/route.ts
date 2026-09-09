import { NextResponse, type NextRequest } from 'next/server'

import { createProtectedAdminRouteHandler } from '@/lib/admin-route-handler'
import { resolveServerLocale, serverT } from '@/lib/i18n/server'
import { recordAdminOperationAuditLog } from '@/lib/admin-operation-audit-service'
import { prisma } from '@/lib/db'
import { cancelExpiredPendingOrders } from '@/lib/shop-order-cleanup-service'

/**
 * 取消超时未支付的待支付订单（默认 30 分钟）。
 * 管理员后台按钮触发，或外部 cron 定时调用。
 */
export const POST = createProtectedAdminRouteHandler(
  async (request: NextRequest, authResult) => {
    const t = serverT(resolveServerLocale(request))
    const { cancelled } = await cancelExpiredPendingOrders()

    await recordAdminOperationAuditLog(prisma, {
      adminUsername: authResult.payload?.username ?? 'unknown',
      operationType: 'SHOP_ORDER_CLEANUP',
      targetLabel: '超时订单清理',
      detail: { cancelled },
    })

    return NextResponse.json({
      success: true,
      cancelled,
      message: t('cleanup.expiredOrders', { cancelled }),
    })
  },
  { logLabel: 'shop-order-cleanup' },
)