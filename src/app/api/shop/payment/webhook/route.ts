import { timingSafeEqual } from 'node:crypto'

import { NextResponse, type NextRequest } from 'next/server'

import { resolveServerLocale, serverT } from '@/lib/i18n/server'
import { guardShopApiRateLimit } from '@/lib/shop-api-rate-limit'
import { getEnabledPaymentConfig } from '@/lib/shop-payment-registry'
import { getPaymentProvider } from '@/lib/shop-payment-registry'
import { fulfillShopOrder } from '@/lib/shop-fulfillment-service'

export const dynamic = 'force-dynamic'

const WEBHOOK_SECRET_HEADER = 'x-webhook-secret'

/**
 * 通用支付回调：自建支付监控/渠道回调 POST 到此处触发自动发卡。
 * 回调体：{ orderNo, paid, transactionId? }
 *
 * 安全：渠道配置 secret 后，回调必须携带 x-webhook-secret 头（timingSafeEqual 比较），
 * 防止未授权调用触发免费发卡。
 */
export async function POST(request: NextRequest) {
  const t = serverT(resolveServerLocale(request))

  const rateLimit = guardShopApiRateLimit(request, '/api/shop/payment/webhook')
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  const bodyText = await request.text()

  const provider = getPaymentProvider('webhook')
  const config = await getEnabledPaymentConfig('webhook')

  if (!provider || !config) {
    return NextResponse.json({ success: false, message: t('payment.callbackChannelDisabled') }, { status: 400 })
  }

  // secret 鉴权：配置了 secret 就必须匹配，未配置时向后兼容（但强烈建议配置）
  const configuredSecret = config.secret?.trim()
  if (configuredSecret) {
    const providedSecret = request.headers.get(WEBHOOK_SECRET_HEADER) ?? ''
    if (!verifySecret(providedSecret, configuredSecret)) {
      return NextResponse.json({ success: false, message: t('payment.callbackUnauthorized') }, { status: 401 })
    }
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
  }, t)

  if (!result.success) {
    return NextResponse.json({ success: false, message: result.message ?? t('payment.fulfillFailed') }, { status: 400 })
  }

  return NextResponse.json({
    success: true,
    alreadyProcessed: result.alreadyProcessed ?? false,
    message: result.alreadyProcessed ? t('shop.paymentProcessed') : t('payment.fulfillSuccess'),
  })
}

function verifySecret(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) {
    return false
  }
  const providedBuffer = Buffer.from(provided, 'utf-8')
  const expectedBuffer = Buffer.from(expected, 'utf-8')
  return timingSafeEqual(providedBuffer, expectedBuffer)
}
