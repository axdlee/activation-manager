import { NextResponse, type NextRequest } from 'next/server'

import { createProtectedAdminRouteHandler } from '@/lib/admin-route-handler'
import { recordAdminOperationAuditLog } from '@/lib/admin-operation-audit-service'
import { prisma } from '@/lib/db'
import { sendBuyerOrderFulfilledEmail } from '@/lib/notification-events'
import { SHOP_ORDER_STATUS } from '@/lib/shop-order-service'

export const dynamic = 'force-dynamic'

/**
 * 重发买家卡密邮件（管理员）：
 * POST /api/admin/shop/orders/[orderNo]/resend-email
 * 仅已发卡（fulfilled）且买家留了邮箱的订单可重发；邮件渠道未配置时明确提示。
 */
export const POST = createProtectedAdminRouteHandler<
  NextRequest,
  [{ params: { orderNo: string } }]
>(async (_request, authResult, context) => {
  const { orderNo } = context.params

  const order = await prisma.shopOrder.findUnique({
    where: { orderNo },
    include: { product: true },
  })

  if (!order) {
    return NextResponse.json({ success: false, message: '订单不存在' }, { status: 404 })
  }

  if (order.status !== SHOP_ORDER_STATUS.FULFILLED) {
    return NextResponse.json(
      { success: false, message: '订单尚未发卡，无法发送卡密邮件' },
      { status: 400 },
    )
  }

  const recipient = order.contactEmail?.trim() ?? ''
  if (!recipient) {
    return NextResponse.json(
      { success: false, message: '订单未留邮箱，无法发送邮件（可让买家凭订单号+联系方式在购买页找回）' },
      { status: 400 },
    )
  }

  const codes = await prisma.activationCode.findMany({
    where: { id: { in: parseCodeIds(order.fulfilledCodeIds) } },
    orderBy: { id: 'asc' },
    select: { code: true },
  })

  if (codes.length === 0) {
    return NextResponse.json({ success: false, message: '订单没有已发卡密' }, { status: 400 })
  }

  const sent = await sendBuyerOrderFulfilledEmail({
    to: recipient,
    orderNo: order.orderNo,
    productName: order.product.name,
    amountInCents: order.amountInCents,
    codes: codes.map((code) => code.code),
  })

  await recordAdminOperationAuditLog(prisma, {
    adminUsername: authResult.payload?.username ?? 'unknown',
    operationType: 'SHOP_ORDER_RESEND_EMAIL',
    targetLabel: orderNo,
    detail: { recipient, sent },
  })

  if (!sent) {
    return NextResponse.json(
      { success: false, message: '发送失败：邮件通知未配置或 SMTP 发送异常，请检查系统配置的邮件通知设置' },
      { status: 502 },
    )
  }

  return NextResponse.json({ success: true, message: `卡密邮件已重新发送至 ${recipient}` })
}, { logLabel: 'shop-order-resend-email' })

function parseCodeIds(fulfilledCodeIds: string | null): number[] {
  if (!fulfilledCodeIds) {
    return []
  }
  try {
    const parsed = JSON.parse(fulfilledCodeIds) as unknown
    return Array.isArray(parsed)
      ? parsed.filter((item): item is number => typeof item === 'number')
      : []
  } catch {
    return []
  }
}
