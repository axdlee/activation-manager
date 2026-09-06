import { NextResponse, type NextRequest } from 'next/server'

import { getEnabledPaymentConfig } from '@/lib/shop-payment-registry'
import { getPaymentProvider } from '@/lib/shop-payment-registry'
import { fulfillShopOrder } from '@/lib/shop-fulfillment-service'

export const dynamic = 'force-dynamic'

/**
 * 通用支付回调：自建支付监控/渠道回调 POST 到此处触发自动发卡。
 * 回调体：{ orderNo, paid, transactionId? }
 */
export async function POST(request: NextRequest) {
  const bodyText = await request.text()

  const provider = getPaymentProvider('webhook')
  const config = await getEnabledPaymentConfig('webhook')

  if (!provider || !config) {
    return NextResponse.json({ success: false, message: '回调渠道未启用' }, { status: 400 })
  }

  const context = await provider.verifyCallback(bodyText, config)
  if (!context) {
    return NextResponse.json({ success: false, message: '回调校验失败' }, { status: 400 })
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

  return NextResponse.json({
    success: true,
    alreadyProcessed: result.alreadyProcessed ?? false,
    message: result.alreadyProcessed ? '订单已处理' : '发卡成功',
  })
}
