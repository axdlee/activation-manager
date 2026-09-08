import { NextResponse, type NextRequest } from 'next/server'

import { createProtectedAdminRouteHandler } from '@/lib/admin-route-handler'
import { recordAdminOperationAuditLog } from '@/lib/admin-operation-audit-service'
import { prisma } from '@/lib/db'
import { cancelExpiredPendingOrders } from '@/lib/shop-order-cleanup-service'

/**
 * 取消超时未支付的待支付订单（默认 30 分钟）。
 * 管理员后台按钮触发，或外部 cron 定时调用。
 */
export const POST = createProtectedAdminRouteHandler(
  async (_request: NextRequest, authResult) => {
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
      message: `已取消 ${cancelled} 笔超时未支付订单`,
    })
  },
  { logLabel: 'shop-order-cleanup' },
)