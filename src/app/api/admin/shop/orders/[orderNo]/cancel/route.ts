import { NextResponse, type NextRequest } from 'next/server'

import { createProtectedAdminRouteHandler } from '@/lib/admin-route-handler'
import { prisma } from '@/lib/db'
import { recordAdminOperationAuditLog } from '@/lib/admin-operation-audit-service'
import { ShopOrderError, cancelShopOrderByAdmin } from '@/lib/shop-order-service'

/**
 * 管理员取消未支付订单：仅 pending 可取消（幂等防并发），
 * 事务内同步释放该订单的 RESERVED 预占库存（不等 TTL）。
 */
export const POST = createProtectedAdminRouteHandler(
  async (_request: NextRequest, authResult, { params }: { params: { orderNo: string } }) => {
    const orderNo = params.orderNo
    const adminUsername = authResult.payload?.username ?? 'unknown'

    try {
      const result = await cancelShopOrderByAdmin(orderNo, prisma)

      await recordAdminOperationAuditLog(prisma, {
        adminUsername,
        operationType: 'SHOP_ORDER_CANCELLED',
        targetLabel: orderNo,
        detail: {
          orderNo,
          releasedStockCount: result.releasedStockCount,
        },
      })

      return NextResponse.json({
        success: true,
        releasedStockCount: result.releasedStockCount,
      })
    } catch (error) {
      if (error instanceof ShopOrderError) {
        return NextResponse.json(
          { success: false, message: error.message },
          { status: error.statusCode },
        )
      }
      throw error
    }
  },
  { logLabel: 'shop-order-cancel' },
)
