import { NextResponse, type NextRequest } from 'next/server'

import { resolveServerLocale, serverT } from '@/lib/i18n/server'
import { guardShopApiRateLimit } from '@/lib/shop-api-rate-limit'
import { getEnabledPaymentConfig } from '@/lib/shop-payment-registry'
import { getPaymentProvider } from '@/lib/shop-payment-registry'
import { fulfillShopOrder } from '@/lib/shop-fulfillment-service'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const t = serverT(resolveServerLocale(request))

  const rateLimit = guardShopApiRateLimit(request, '/api/shop/payment/alipay')
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  const bodyText = await request.text()

  const provider = getPaymentProvider('alipay')
  const config = await getEnabledPaymentConfig('alipay')

  if (!provider || !config) {
    return NextResponse.json({ success: false, message: t('shop.paymentProviderDisabled') }, { status: 400 })
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

  return NextResponse.json({ success: true, message: 'success' })
}
