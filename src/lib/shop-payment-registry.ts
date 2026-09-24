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

/** verified 渠道处于启用态但必需配置缺失（如易支付 key 被清空）时抛出 */
export class PaymentCallbackConfigIncompleteError extends Error {}

/**
 * 回调路由专用：读取已启用渠道配置，并对真实验签渠道（callbackTrust ===
 * 'verified'）强制校验必需配置项齐全。
 *
 * 背景：存量库可能存在「渠道已启用但配置后来被改空」的状态（旧版本
 * 只在显式启用时校验）。此时验签密钥为空，任何伪造回调都能通过签名
 * 校验（空字符串 key 签名可被复算），必须在运行时兜底拒绝。
 * 返回 null 表示渠道未启用；配置不完整抛 PaymentCallbackConfigIncompleteError。
 */
export async function getEnabledCallbackConfig(
  providerId: string,
): Promise<Record<string, string> | null> {
  const provider = getPaymentProvider(providerId)
  const config = await getEnabledPaymentConfig(providerId)

  if (!provider || !config) {
    return null
  }

  if (provider.callbackTrust === 'verified') {
    const missingKeys = provider.requiredConfigKeys.filter((key) => !config[key]?.trim())
    if (missingKeys.length > 0) {
      throw new PaymentCallbackConfigIncompleteError(
        `渠道配置不完整，已拒绝回调：${missingKeys.join(', ')}`,
      )
    }
  }

  return config
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
    nameKey?: string
    supportsOnlinePayment: boolean
  }> = []

  const manualRaw = await getRawPaymentConfig('manual')

  for (const provider of listEnabledPaymentProviders()) {
    // 占位渠道（验签未实现，如支付宝/微信官方通道）不对前台展示，
    // 避免买家选出永远无法完成支付的订单；即使存量库误启用也排除
    if (provider.callbackTrust === 'placeholder') {
      continue
    }
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
      nameKey: provider.nameKey,
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
