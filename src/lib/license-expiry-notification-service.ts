import { getConfigWithDefault } from './config-service'
import { notifyLicenseExpiryEvent } from './notification-events'
import { type LicenseActionCodeRecord } from './license-action-context'

/**
 * 激活码到期/耗尽通知服务：
 * 通过通用通知系统分发（webhook / 邮件 / 短信，见 notification-service）。
 * - 未配置 notifyWebhookUrl 时，LICENSE_EXPIRED 事件回落到旧 expiryWebhookUrl，
 *   且保持原始扁平 payload 结构（向后兼容，见 notification-service）
 * 设计原则：
 * - fire-and-forget：异步发送，失败不阻塞主业务
 * - 进程内去重：同一激活码只通知一次（按 code + 到期时间戳去重）
 */

export type ExpiryNotificationPayload = {
  event: 'LICENSE_EXPIRED'
  code: string
  projectKey: string
  licenseMode: string | null
  machineId: string | null
  expiresAt: string | null
  remainingCount: number | null
  notifiedAt: string
}

// 进程内去重：避免每次 status/consume 查询都对同一到期码重复通知
const notifiedKeys = new Set<string>()

function buildNotificationKey(activationCode: LicenseActionCodeRecord) {
  const expiresAt =
    activationCode.expiresAt !== null && activationCode.expiresAt !== undefined
      ? new Date(activationCode.expiresAt).toISOString()
      : 'no-expiry'
  return `${activationCode.code}:${expiresAt}:${activationCode.remainingCount ?? ''}`
}

export async function getExpiryWebhookUrl(): Promise<string> {
  const value = await getConfigWithDefault('expiryWebhookUrl')
  if (typeof value !== 'string') {
    return ''
  }

  const trimmed = value.trim()
  // 仅允许 http/https，避免误配其他协议
  if (trimmed && !/^https?:\/\//i.test(trimmed)) {
    console.warn('[webhook] 到期通知接口仅支持 http/https 协议，已忽略:', trimmed)
    return ''
  }

  return trimmed
}

export function buildExpiryNotificationPayload(
  activationCode: LicenseActionCodeRecord,
): ExpiryNotificationPayload {
  return {
    event: 'LICENSE_EXPIRED',
    code: activationCode.code,
    projectKey: activationCode.project?.projectKey ?? '',
    licenseMode: activationCode.licenseMode ?? null,
    machineId: activationCode.usedBy ?? null,
    expiresAt: activationCode.expiresAt ? new Date(activationCode.expiresAt).toISOString() : null,
    remainingCount:
      typeof activationCode.remainingCount === 'number' ? activationCode.remainingCount : null,
    notifiedAt: new Date().toISOString(),
  }
}

/**
 * 发送到期通知（幂等去重）。
 * 返回是否实际发送（false = 未配置 URL 或已通知过）。
 * 调用方无需 await（fire-and-forget）。
 */
export function notifyLicenseExpiry(activationCode: LicenseActionCodeRecord): boolean {
  const key = buildNotificationKey(activationCode)
  if (notifiedKeys.has(key)) {
    return false
  }
  notifiedKeys.add(key)

  notifyLicenseExpiryEvent(activationCode)
  return true
}

/** 仅测试使用：清空去重状态 */
export function resetExpiryNotificationDeduplication() {
  notifiedKeys.clear()
}
