import { NextResponse, type NextRequest } from 'next/server'

import { isShopEnabled } from '@/lib/shop-access'
import { resolveServerLocale, serverT } from '@/lib/i18n/server'

import { listAvailablePaymentChannels } from '@/lib/shop-payment-registry'

export const dynamic = 'force-dynamic'

// 公开：可用的支付渠道列表
export async function GET(request: NextRequest) {
  const t = serverT(resolveServerLocale(request))

  if (!(await isShopEnabled())) {
    return NextResponse.json({ success: false, message: t('shop.disabled') }, { status: 403 })
  }

  const channels = await listAvailablePaymentChannels()

  return NextResponse.json({
    success: true,
    channels: channels.map((channel) => ({
      id: channel.id,
      name: channel.nameKey ? t(channel.nameKey) : channel.name,
      supportsOnlinePayment: channel.supportsOnlinePayment,
    })),
  })
}
