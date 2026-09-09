import { NextResponse, type NextRequest } from 'next/server'

import { isShopEnabled } from '@/lib/shop-access'

import { resolveServerLocale, serverT } from '@/lib/i18n/server'
import { prisma } from '@/lib/db'
import { guardShopApiRateLimit } from '@/lib/shop-api-rate-limit'
import { getPaymentProvider } from '@/lib/shop-payment-registry'
import { getEnabledPaymentConfig } from '@/lib/shop-payment-registry'
import {
  buildShopOrderInfo,
  createShopOrder,
  normalizeShopOrderQuantity,
  ShopOrderError,
} from '@/lib/shop-order-service'

export const dynamic = 'force-dynamic'

type CreateOrderBody = {
  productId?: number
  providerId?: string
  quantity?: number
  contactEmail?: string
  contactPhone?: string
  contactWechat?: string
  paymentNote?: string
  remark?: string
}

// 公开下单：校验联系方式、生成订单、返回支付信息
export async function POST(request: NextRequest) {
  const t = serverT(resolveServerLocale(request))

  if (!(await isShopEnabled())) {
    return NextResponse.json({ success: false, message: t('shop.disabled') }, { status: 403 })
  }

  const rateLimit = guardShopApiRateLimit(request, '/api/shop/orders')
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const body = (await request.json()) as CreateOrderBody

    if (!body.productId || !body.providerId) {
      return NextResponse.json(
        { success: false, message: t('shop.productOrProviderRequired') },
        { status: 400 },
      )
    }

    const { order, product } = await createShopOrder({
      productId: Number(body.productId),
      providerId: body.providerId,
      quantity: normalizeShopOrderQuantity(body.quantity, t),
      contactEmail: body.contactEmail,
      contactPhone: body.contactPhone,
      contactWechat: body.contactWechat,
      paymentNote: body.paymentNote,
      remark: body.remark,
    }, t)

    // 生成支付信息
    const provider = getPaymentProvider(body.providerId)
    const paymentConfig = await getEnabledPaymentConfig(body.providerId)

    if (!provider || !paymentConfig) {
      return NextResponse.json(
        { success: false, message: t('shop.paymentProviderUnavailable') },
        { status: 400 },
      )
    }

    const fullOrder = await prisma.shopOrder.findUniqueOrThrow({
      where: { id: order.id },
      include: { product: true },
    })

    const payment = await provider.createPayment(
      buildShopOrderInfo(fullOrder),
      paymentConfig,
    )

    return NextResponse.json({
      success: true,
      order: {
        orderNo: order.orderNo,
        quantity: order.quantity,
        amountInCents: order.amountInCents,
        status: order.status,
        provider: order.provider,
        productName: product.name,
        createdAt: order.createdAt,
      },
      payment,
    })
  } catch (error) {
    if (error instanceof ShopOrderError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.statusCode },
      )
    }

    console.error('创建订单失败:', error)
    return NextResponse.json(
      { success: false, message: t('api.internalError') },
      { status: 500 },
    )
  }
}
