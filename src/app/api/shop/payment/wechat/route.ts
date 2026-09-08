import { NextResponse, type NextRequest } from 'next/server'

import { guardShopApiRateLimit } from '@/lib/shop-api-rate-limit'
import { getEnabledPaymentConfig } from '@/lib/shop-payment-registry'
import { getPaymentProvider } from '@/lib/shop-payment-registry'
import { fulfillShopOrder } from '@/lib/shop-fulfillment-service'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const rateLimit = guardShopApiRateLimit(request, '/api/shop/payment/wechat')
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  const bodyText = await request.text()

  const provider = getPaymentProvider('wechat')
  const config = await getEnabledPaymentConfig('wechat')

  if (!provider || !config) {
    return NextResponse.json({ success: false, message: '微信支付渠道未启用' }, { status: 400 })
  }

  const context = await provider.verifyCallback(bodyText, config)
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

  if (!result.success) {
    return NextResponse.json({ success: false, message: result.message ?? '发卡失败' }, { status: 400 })
  }

  return NextResponse.json({ success: true, message: 'OK' })
}
