import { NextResponse } from 'next/server'

import { isShopEnabled } from '@/lib/shop-access'

import { listAvailablePaymentChannels } from '@/lib/shop-payment-registry'

export const dynamic = 'force-dynamic'

// 公开：可用的支付渠道列表
export async function GET() {
  if (!(await isShopEnabled())) {
    return NextResponse.json({ success: false, message: '购买中心已停用' }, { status: 403 })
  }

  const channels = await listAvailablePaymentChannels()

  return NextResponse.json({
    success: true,
    channels: channels.map((channel) => ({
      id: channel.id,
      name: channel.name,
      supportsOnlinePayment: channel.supportsOnlinePayment,
    })),
  })
}
