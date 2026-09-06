import { NextResponse, type NextRequest } from 'next/server'

import { prisma } from '@/lib/db'
import { guardShopApiRateLimit } from '@/lib/shop-api-rate-limit'
import { SHOP_ORDER_STATUS } from '@/lib/shop-order-service'

export const dynamic = 'force-dynamic'

/**
 * 订单详情查询（供下单页轮询状态 / 获取已发卡密）。
 * 仅返回订单状态与已发卡密；联系方式等敏感信息不暴露。
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { orderNo: string } },
) {
  const rateLimit = guardShopApiRateLimit(request, '/api/shop/orders/detail')
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  const orderNo = params.orderNo

  const order = await prisma.shopOrder.findUnique({
    where: { orderNo },
    include: { product: true },
  })

  if (!order) {
    return NextResponse.json({ success: false, message: '订单不存在' }, { status: 404 })
  }

  let codes: Array<{ id: number; code: string; cardType: string | null }> = []
  if (order.fulfilledCodeIds) {
    try {
      const codeIds = JSON.parse(order.fulfilledCodeIds) as number[]
      codes = await prisma.activationCode.findMany({
        where: { id: { in: codeIds } },
        orderBy: { id: 'asc' },
        select: { id: true, code: true, cardType: true },
      })
    } catch {
      codes = []
    }
  }

  return NextResponse.json({
    success: true,
    order: {
      orderNo: order.orderNo,
      status: order.status,
      amountInCents: order.amountInCents,
      productName: order.product.name,
      createdAt: order.createdAt,
    },
    codes: order.status === SHOP_ORDER_STATUS.FULFILLED ? codes : [],
  })
}
