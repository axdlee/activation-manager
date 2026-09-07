import { prisma } from './db'
import {
  manualPaymentProvider,
  webhookPaymentProvider,
} from './shop-payment-providers'
import {
  yipayPaymentProvider,
  wechatPayProvider,
  alipayProvider,
} from './shop-payment-providers-extra'
import {
  type PaymentProvider,
  type PaymentProviderRegistry,
} from './shop-payment-types'

export const paymentProviderRegistry: PaymentProviderRegistry = {
  manual: manualPaymentProvider,
  webhook: webhookPaymentProvider,
  yipay: yipayPaymentProvider,
  wechat: wechatPayProvider,
  alipay: alipayProvider,
}

export function getPaymentProvider(providerId: string): PaymentProvider | null {
  return paymentProviderRegistry[providerId] ?? null
}

export function listEnabledPaymentProviders(): PaymentProvider[] {
  return Object.values(paymentProviderRegistry)
}

/**
 * 读取某个渠道的启用配置（未启用返回 null）。
 * 注：与 getRawPaymentConfig 不同，这里不校验配置完整性——完整性由调用方决定。
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

  return parsePaymentConfig(record.configJson)
}

export async function getRawPaymentConfig(
  providerId: string,
): Promise<{ isEnabled: boolean; config: Record<string, string> } | null> {
  const record = await prisma.shopPaymentConfig.findUnique({
    where: { provider: providerId },
  })
  if (!record) {
    return null
  }
  return { isEnabled: record.isEnabled, config: parsePaymentConfig(record.configJson) }
}

function parsePaymentConfig(configJson: string): Record<string, string> {
  try {
    const parsed = JSON.parse(configJson) as Record<string, unknown>
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

function isProviderConfigComplete(provider: PaymentProvider, config: Record<string, string>) {
  return provider.requiredConfigKeys.every((key) => Boolean(config[key]?.trim()))
}

/**
 * 读取当前可用于下单的支付渠道：
 * - 渠道需在后台启用（isEnabled）
 * - 且必需配置项齐全（如易支付需 gateway/pid/key）
 * - 兜底：若可用渠道为空且手动确认渠道未被显式禁用，则展示 manual
 */
export async function listAvailablePaymentChannels() {
  const channels: Array<{
    id: string
    name: string
    supportsOnlinePayment: boolean
  }> = []

  const manualRaw = await getRawPaymentConfig('manual')

  for (const provider of listEnabledPaymentProviders()) {
    const record = await getRawPaymentConfig(provider.id)
    if (!record || !record.isEnabled) {
      continue
    }
    if (!isProviderConfigComplete(provider, record.config)) {
      continue
    }
    channels.push({
      id: provider.id,
      name: provider.name,
      supportsOnlinePayment: provider.supportsOnlinePayment,
    })
  }

  // 兜底：没有任何可用渠道时，只要 manual 未被显式禁用（isEnabled !== false，
  // 含从未配置/默认启用两种情况），就提供手动收款确认作为兜底
  if (channels.length === 0 && manualRaw && manualRaw.isEnabled !== false) {
    channels.push({
      id: manualPaymentProvider.id,
      name: manualPaymentProvider.name,
      supportsOnlinePayment: manualPaymentProvider.supportsOnlinePayment,
    })
  }

  return channels
}
