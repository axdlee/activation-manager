import { getConfigWithDefault } from './config-service'
import { type LicenseActionCodeRecord } from './license-action-context'

/**
 * 激活码到期/耗尽通知服务：
 * 向系统配置的 expiryWebhookUrl 发送 POST JSON 通知。
 * 设计原则：
 * - fire-and-forget：异步发送，失败不阻塞主业务
 * - 进程内去重：同一激活码只通知一次（按 code + 到期时间戳去重）
 * - 空 URL 不发送；超时保护（5s）
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
  return typeof value === 'string' ? value.trim() : ''
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

  void (async () => {
    try {
      const webhookUrl = await getExpiryWebhookUrl()
      if (!webhookUrl) {
        return
      }

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)

      try {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(buildExpiryNotificationPayload(activationCode)),
          signal: controller.signal,
        })

        if (!response.ok) {
          console.warn(`[webhook] 到期通知返回非 2xx: ${response.status}（${webhookUrl}）`)
        }
      } finally {
        clearTimeout(timeout)
      }
    } catch (error) {
      console.warn(
        `[webhook] 到期通知发送异常（${activationCode.code}）:`,
        error instanceof Error ? error.message : String(error),
      )
    }
  })()

  return true
}

/** 仅测试使用：清空去重状态 */
export function resetExpiryNotificationDeduplication() {
  notifiedKeys.clear()
}
