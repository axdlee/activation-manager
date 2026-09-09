import { NextResponse, type NextRequest } from 'next/server'

import { isShopEnabled } from '@/lib/shop-access'

import { resolveServerLocale, serverT } from '@/lib/i18n/server'
import { prisma } from '@/lib/db'
import { guardShopApiRateLimit } from '@/lib/shop-api-rate-limit'

export const dynamic = 'force-dynamic'

/**
 * 订单查询 / 卡密找回：
 * POST { orderNo, contactEmail | contactPhone | contactWechat }
 * 校验联系方式匹配后返回订单与已发卡密。
 */
export async function POST(request: NextRequest) {
  const t = serverT(resolveServerLocale(request))

  if (!(await isShopEnabled())) {
    return NextResponse.json({ success: false, message: t('shop.disabled') }, { status: 403 })
  }

  const rateLimit = guardShopApiRateLimit(request, '/api/shop/orders/query')
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const body = (await request.json()) as {
      orderNo?: string
      contactEmail?: string
      contactPhone?: string
      contactWechat?: string
    }

    if (!body.orderNo) {
      return NextResponse.json({ success: false, message: t('shop.orderNoRequired') }, { status: 400 })
    }

    const contact = body.contactEmail?.trim() || body.contactPhone?.trim() || body.contactWechat?.trim()
    if (!contact) {
      return NextResponse.json(
        { success: false, message: t('shop.contactQueryRequired') },
        { status: 400 },
      )
    }

    const order = await prisma.shopOrder.findUnique({
      where: { orderNo: body.orderNo.trim() },
      include: { product: true },
    })

    if (!order) {
      return NextResponse.json({ success: false, message: t('shop.orderNotFound') }, { status: 404 })
    }

    // 联系方式校验（三项任一匹配即可）
    const contactMatched =
      (order.contactEmail && order.contactEmail === body.contactEmail?.trim()) ||
      (order.contactPhone && order.contactPhone === body.contactPhone?.trim()) ||
      (order.contactWechat && order.contactWechat === body.contactWechat?.trim())

    if (!contactMatched) {
      return NextResponse.json(
        { success: false, message: t('shop.contactMismatch') },
        { status: 403 },
      )
    }

    // 解析已发卡密 id 列表
    let codes: Array<{ id: number; code: string; cardType: string | null }> = []
    if (order.fulfilledCodeIds) {
      try {
        const codeIds = JSON.parse(order.fulfilledCodeIds) as number[]
        codes = await prisma.activationCode.findMany({
          where: { id: { in: codeIds } },
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
        paidAt: order.paidAt,
        fulfilledAt: order.fulfilledAt,
      },
      codes,
    })
  } catch (error) {
    console.error('查询订单失败:', error)
    return NextResponse.json({ success: false, message: t('api.internalError') }, { status: 500 })
  }
}
