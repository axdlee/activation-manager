import { NextResponse, type NextRequest } from 'next/server'

import { guardShopApiRateLimit } from '@/lib/shop-api-rate-limit'
import { getEnabledPaymentConfig, getPaymentProvider } from '@/lib/shop-payment-registry'
import { fulfillShopOrder } from '@/lib/shop-fulfillment-service'

export const dynamic = 'force-dynamic'

/** 支持统一回调的在线支付渠道（manual 为人工确认，无回调语义） */
const NOTIFY_SUPPORTED_PROVIDERS = new Set(['yipay', 'wechat', 'alipay'])

/**
 * 支付回调统一入口：POST /api/shop/payment/notify/[provider]
 * 支付网关只需配置一种 URL 模式（.../notify/yipay、.../notify/alipay …），
 * 内部按 provider 分发到对应适配器验签并发卡。
 * 与各渠道独立回调路由（/api/shop/payment/yipay 等）等价，二者可并存。
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { provider: string } },
) {
  const { provider } = params

  if (!NOTIFY_SUPPORTED_PROVIDERS.has(provider)) {
    return NextResponse.json({ success: false, message: '不支持的回调渠道' }, { status: 404 })
  }

  const rateLimit = guardShopApiRateLimit(request, `/api/shop/payment/notify/${provider}`)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  const bodyText = await request.text()

  const paymentProvider = getPaymentProvider(provider)
  const config = await getEnabledPaymentConfig(provider)

  if (!paymentProvider || !config) {
    return NextResponse.json(
      { success: false, message: '支付渠道未启用' },
      { status: 400 },
    )
  }

  const context = await paymentProvider.verifyCallback(bodyText, config)
  if (!context) {
    return NextResponse.json({ success: false, message: '签名校验失败' }, { status: 400 })
  }

  if (!context.paid) {
    return NextResponse.json({ success: true, message: '未支付，忽略' })
  }

  const result = await fulfillShopOrder({
    orderNo: context.orderNo,
    transactionId: context.transactionId,
  })

  if (!result.success && !result.alreadyProcessed) {
    return NextResponse.json({ success: false, message: result.message ?? '发卡失败' }, { status: 400 })
  }

  return NextResponse.json({ success: true, message: '回调处理成功' })
}
