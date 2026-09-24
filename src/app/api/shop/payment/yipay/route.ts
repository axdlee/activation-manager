import { NextResponse, type NextRequest } from 'next/server'

import { resolveServerLocale, serverT } from '@/lib/i18n/server'
import { guardShopApiRateLimit } from '@/lib/shop-api-rate-limit'
import {
  PaymentCallbackConfigIncompleteError,
  getEnabledCallbackConfig,
  getPaymentProvider,
} from '@/lib/shop-payment-registry'
import { fulfillShopOrder } from '@/lib/shop-fulfillment-service'

export const dynamic = 'force-dynamic'

/**
 * 易支付回调：支付网关 POST 通知到此处。
 * 签名校验：MD5(参数键值对排序 + key)
 */
export async function POST(request: NextRequest) {
  const t = serverT(resolveServerLocale(request))

  const rateLimit = guardShopApiRateLimit(request, '/api/shop/payment/yipay')
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  const bodyText = await request.text()

  const provider = getPaymentProvider('yipay')

  let config: Record<string, string> | null
  try {
    config = await getEnabledCallbackConfig('yipay')
  } catch (error) {
    // 已启用但 key 等必需配置缺失的存量数据：空密钥验签等于没有验签，
    // 运行时兜底拒绝伪造回调
    if (error instanceof PaymentCallbackConfigIncompleteError) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400 })
    }
    throw error
  }

  if (!provider || !config) {
    return NextResponse.json({ success: false, message: t('payment.channelDisabled') }, { status: 400 })
  }

  const context = await provider.verifyCallback(bodyText, config)
  if (!context) {
    return NextResponse.json({ success: false, message: t('payment.callbackVerifyFailed') }, { status: 400 })
  }

  if (!context.paid) {
    return NextResponse.json({ success: true, message: t('payment.callbackNotPaid') })
  }

  const result = await fulfillShopOrder({
    orderNo: context.orderNo,
    transactionId: context.transactionId,
    expectedProvider: 'yipay',
    ...(context.paidAmountCents !== undefined ? { expectedAmountInCents: context.paidAmountCents } : {}),
  }, t)

  if (!result.success) {
    return NextResponse.json({ success: false, message: result.message ?? t('payment.fulfillFailed') }, { status: 400 })
  }

  return NextResponse.json({ success: true, message: 'success' })
}
