import { prisma } from './db'
import {
  manualPaymentProvider,
  webhookPaymentProvider,
} from './shop-payment-providers'
import {
  type PaymentProvider,
  type PaymentProviderRegistry,
} from './shop-payment-types'

export const paymentProviderRegistry: PaymentProviderRegistry = {
  manual: manualPaymentProvider,
  webhook: webhookPaymentProvider,
}

export function getPaymentProvider(providerId: string): PaymentProvider | null {
  return paymentProviderRegistry[providerId] ?? null
}

export function listEnabledPaymentProviders(): PaymentProvider[] {
  return Object.values(paymentProviderRegistry)
}

/**
 * 读取某个渠道的启用配置。未启用返回 null。
 */
export async function getEnabledPaymentConfig(
  providerId: string,
): Promise<Record<string, string> | null> {
  const record = await prisma.shopPaymentConfig.findUnique({
    where: { provider: providerId },
  })

  if (!record || !record.isEnabled) {
    return null
  }

  try {
    const parsed = JSON.parse(record.configJson) as Record<string, unknown>
    const result: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string') {
        result[key] = value
      }
    }
    return result
  } catch {
    return {}
  }
}

/**
 * 读取当前启用的支付渠道列表（含渠道展示信息）。
 */
export async function listAvailablePaymentChannels() {
  const channels: Array<{
    id: string
    name: string
    supportsOnlinePayment: boolean
    config: Record<string, string> | null
  }> = []

  for (const provider of listEnabledPaymentProviders()) {
    const config = await getEnabledPaymentConfig(provider.id)
    if (config) {
      channels.push({
        id: provider.id,
        name: provider.name,
        supportsOnlinePayment: provider.supportsOnlinePayment,
        config,
      })
    }
  }

  return channels
}
