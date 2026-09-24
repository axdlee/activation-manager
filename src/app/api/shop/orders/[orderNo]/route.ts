import { timingSafeEqual } from 'node:crypto'

import { NextResponse, type NextRequest } from 'next/server'

import { resolveServerLocale, serverT } from '@/lib/i18n/server'
import { prisma } from '@/lib/db'
import { guardShopApiRateLimit } from '@/lib/shop-api-rate-limit'
import { isShopEnabled } from '@/lib/shop-access'
import { SHOP_ORDER_STATUS } from '@/lib/shop-order-service'

export const dynamic = 'force-dynamic'

/**
 * 订单详情查询（供下单页轮询状态 / 获取已发卡密）。
 * 仅返回订单状态与已发卡密；联系方式等敏感信息不暴露。
 */
// 可注入 prisma 客户端（测试用临时库），生产路径绑定全局单例
export async function getShopOrderDetailRoute(
  request: NextRequest,
  { params }: { params: { orderNo: string } },
  client: typeof prisma = prisma,
) {
  const t = serverT(resolveServerLocale(request))

  if (!(await isShopEnabled())) {
    return NextResponse.json({ success: false, message: t('shop.disabled') }, { status: 403 })
  }

  const rateLimit = guardShopApiRateLimit(request, '/api/shop/orders/detail')
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  const orderNo = params.orderNo

  const order = await client.shopOrder.findUnique({
    where: { orderNo },
    include: { product: true },
  })

  if (!order) {
    return NextResponse.json({ success: false, message: t('shop.orderNotFound') }, { status: 404 })
  }

  // 卡密必须携带下单时签发的 accessToken 才能读取，防止仅凭订单号
  // 枚举他人卡密；订单状态轮询不受影响
  const token = request.nextUrl.searchParams.get('token') ?? ''
  const hasValidToken =
    Boolean(order.accessToken) &&
    token.length === order.accessToken!.length &&
    timingSafeEqual(Buffer.from(token), Buffer.from(order.accessToken!))

  let codes: Array<{ id: number; code: string; cardType: string | null }> = []
  if (hasValidToken && order.fulfilledCodeIds) {
    try {
      const codeIds = JSON.parse(order.fulfilledCodeIds) as number[]
      codes = await client.activationCode.findMany({
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

export async function GET(request: NextRequest, context: { params: { orderNo: string } }) {
  return getShopOrderDetailRoute(request, context)
}
