import { NextResponse, type NextRequest } from 'next/server'

import { createProtectedAdminRouteHandler } from '@/lib/admin-route-handler'
import { fulfillShopOrder } from '@/lib/shop-fulfillment-service'

/**
 * 后台手动确认收款并触发发卡（manual 渠道）。
 */
export const POST = createProtectedAdminRouteHandler(
  async (request: NextRequest, authResult, { params }: { params: { orderNo: string } }) => {
    const orderNo = params.orderNo
    const body = (await request.json()) as { transactionId?: string }

    const result = await fulfillShopOrder({
      orderNo,
      transactionId: body.transactionId,
      adminUsername: authResult.payload?.username ?? 'unknown',
    })

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message ?? '确认失败' },
        { status: 400 },
      )
    }

    return NextResponse.json({
      success: true,
      alreadyProcessed: result.alreadyProcessed ?? false,
      codes: result.codes,
    })
  },
  { logLabel: 'shop-order-confirm' },
)
