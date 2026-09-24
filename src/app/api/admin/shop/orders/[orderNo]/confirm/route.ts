import { NextResponse, type NextRequest } from 'next/server'

import { createProtectedAdminRouteHandler } from '@/lib/admin-route-handler'
import { resolveServerLocale, serverT } from '@/lib/i18n/server'
import { fulfillShopOrder } from '@/lib/shop-fulfillment-service'
import { prisma } from '@/lib/db'
import { recordAdminOperationAuditLog } from '@/lib/admin-operation-audit-service'

/**
 * 后台手动确认收款并触发发卡（manual 渠道）。
 */
export const POST = createProtectedAdminRouteHandler(
  async (request: NextRequest, authResult, { params }: { params: { orderNo: string } }) => {
    const t = serverT(resolveServerLocale(request))
    const orderNo = params.orderNo
    const adminUsername = authResult.payload?.username ?? 'unknown'
    const body = (await request.json()) as { transactionId?: string }

    const result = await fulfillShopOrder({
      orderNo,
      transactionId: body.transactionId,
      adminUsername,
    }, t)

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message ?? t('api.confirmFailed') },
        { status: 400 },
      )
    }

    // 审计：管理员确认发卡（此前该操作不留审计；重复确认不重复记）
    if (!result.alreadyProcessed) {
      await recordAdminOperationAuditLog(prisma, {
        adminUsername,
        operationType: 'SHOP_ORDER_FULFILL_CONFIRMED',
        targetLabel: orderNo,
        detail: {
          orderNo,
          codesCount: result.codes?.length ?? 0,
          transactionId: body.transactionId ?? null,
        },
      })
    }

    return NextResponse.json({
      success: true,
      alreadyProcessed: result.alreadyProcessed ?? false,
      codes: result.codes,
    })
  },
  { logLabel: 'shop-order-confirm' },
)
