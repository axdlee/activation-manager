import { NextResponse } from 'next/server'

import { listAvailablePaymentChannels } from '@/lib/shop-payment-registry'

export const dynamic = 'force-dynamic'

// 公开：可用的支付渠道列表
export async function GET() {
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
