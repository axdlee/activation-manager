import { NextResponse, type NextRequest } from 'next/server'

import { createProtectedAdminRouteHandler } from '@/lib/admin-route-handler'
import { resolveServerLocale, serverT } from '@/lib/i18n/server'
import { fulfillShopOrder } from '@/lib/shop-fulfillment-service'

/**
 * 后台手动确认收款并触发发卡（manual 渠道）。
 */
export const POST = createProtectedAdminRouteHandler(
  async (request: NextRequest, authResult, { params }: { params: { orderNo: string } }) => {
    const t = serverT(resolveServerLocale(request))
    const orderNo = params.orderNo
    const body = (await request.json()) as { transactionId?: string }

    const result = await fulfillShopOrder({
      orderNo,
      transactionId: body.transactionId,
      adminUsername: authResult.payload?.username ?? 'unknown',
    }, t)

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message ?? t('api.confirmFailed') },
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
