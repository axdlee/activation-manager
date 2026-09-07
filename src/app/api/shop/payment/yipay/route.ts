import { NextResponse, type NextRequest } from 'next/server'

import { guardShopApiRateLimit } from '@/lib/shop-api-rate-limit'
import { getEnabledPaymentConfig } from '@/lib/shop-payment-registry'
import { getPaymentProvider } from '@/lib/shop-payment-registry'
import { fulfillShopOrder } from '@/lib/shop-fulfillment-service'

export const dynamic = 'force-dynamic'

/**
 * 易支付回调：支付网关 POST 通知到此处。
 * 签名校验：MD5(参数键值对排序 + key)
 */
export async function POST(request: NextRequest) {
  const rateLimit = guardShopApiRateLimit(request, '/api/shop/payment/${route}')
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  const bodyText = await request.text()

  const provider = getPaymentProvider('yipay')
  const config = await getEnabledPaymentConfig('yipay')

  if (!provider || !config) {
    return NextResponse.json({ success: false, message: '易支付渠道未启用' }, { status: 400 })
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

  return NextResponse.json({ success: true, message: 'success' })
}
