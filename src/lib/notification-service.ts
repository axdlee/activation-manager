import { getConfigWithDefault } from './config-service'
import { sendNotificationEmail } from './notification-email'
import { sendNotificationSms } from './notification-sms'

/**
 * 通用通知系统（管理员通知中心）：
 * 把关键业务事件（到期 / 发卡 / 超时取消）同时分发到已配置的渠道：
 * - webhook：notifyWebhookUrl（POST JSON envelope）
 * - 邮件：notifyEmailSmtp*（SMTP，经 nodemailer）
 * - 短信：notifySms*（通用 HTTP 短信网关）
 *
 * 兼容约定：
 * - 旧的「到期通知接口」expiryWebhookUrl 仅在 LICENSE_EXPIRED 事件且未配置
 *   notifyWebhookUrl 时作为回落目标，且保持原有的扁平 payload 结构不变
 * - 未配置的渠道自动跳过；单渠道失败不影响其他渠道，也不会抛出异常
 */

export const NOTIFICATION_EVENTS = {
  LICENSE_EXPIRED: 'LICENSE_EXPIRED',
  SHOP_ORDER_PAID_FULFILLED: 'SHOP_ORDER_PAID_FULFILLED',
  SHOP_ORDER_TIMEOUT_CANCELLED: 'SHOP_ORDER_TIMEOUT_CANCELLED',
} as const

export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[keyof typeof NOTIFICATION_EVENTS]

export type NotificationContent = {
  event: NotificationEvent
  title: string
  body: string
  data: Record<string, unknown>
}

export type NotificationEnvelope = NotificationContent & {
  notifiedAt: string
}

export type NotificationChannelResult = {
  webhook: { sent: boolean; viaLegacyExpiryWebhook?: boolean; skipped?: boolean }
  email: { sent: boolean; skipped?: boolean }
  sms: { sent: number; failed: number; skipped?: boolean }
}

export type NotificationDispatchOptions = {
  /**
   * 覆盖旧「到期通知接口」地址。
   * 默认从系统配置 expiryWebhookUrl 读取；单测可显式传入以隔离共享配置。
   */
  legacyExpiryWebhookUrl?: string
}

function normalizeHttpUrl(value: string) {
  const trimmed = value.trim()
  if (trimmed && !/^https?:\/\//i.test(trimmed)) {
    return ''
  }
  return trimmed
}

export async function getNotificationWebhookUrl(): Promise<string> {
  const value = await getConfigWithDefault('notifyWebhookUrl')
  const normalized = normalizeHttpUrl(typeof value === 'string' ? value : '')
  if (normalized === '' && typeof value === 'string' && value.trim()) {
    console.warn('[notify] 通用通知 Webhook 仅支持 http/https 协议，已忽略:', value.trim())
  }
  return normalized
}

/** 旧到期通知接口（兼容保留，仅 LICENSE_EXPIRED 回落使用） */
async function getLegacyExpiryWebhookUrl(): Promise<string> {
  const value = await getConfigWithDefault('expiryWebhookUrl')
  return normalizeHttpUrl(typeof value === 'string' ? value : '')
}

export function buildNotificationEnvelope(content: NotificationContent): NotificationEnvelope {
  return {
    ...content,
    notifiedAt: new Date().toISOString(),
  }
}

async function postJson(
  url: string,
  payload: unknown,
): Promise<{ sent: boolean }> {
  const fetcher = globalThis.fetch
  if (!fetcher) {
    return { sent: false }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetcher(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    if (!response.ok) {
      console.warn(`[notify] Webhook 返回非 2xx: ${response.status}（${url}）`)
    }
    return { sent: response.ok }
  } catch (error) {
    console.warn(
      `[notify] Webhook 发送失败（${url}）:`,
      error instanceof Error ? error.message : String(error),
    )
    return { sent: false }
  } finally {
    clearTimeout(timeout)
  }
}

async function sendWebhookChannel(
  content: NotificationContent,
  options: NotificationDispatchOptions = {},
): Promise<NotificationChannelResult['webhook']> {
  const genericUrl = await getNotificationWebhookUrl()
  if (genericUrl) {
    return (await postJson(genericUrl, buildNotificationEnvelope(content))) as {
      sent: boolean
    }
  }

  // 回落：到期事件走旧「到期通知接口」，保持原始扁平 payload 结构（向后兼容）
  if (content.event === NOTIFICATION_EVENTS.LICENSE_EXPIRED) {
    const legacyUrl =
      options.legacyExpiryWebhookUrl !== undefined
        ? normalizeHttpUrl(options.legacyExpiryWebhookUrl)
        : await getLegacyExpiryWebhookUrl()
    if (legacyUrl) {
      const result = (await postJson(legacyUrl, content.data)) as { sent: boolean }
      return { ...result, viaLegacyExpiryWebhook: true }
    }
  }

  return { sent: false, skipped: true }
}

/**
 * 同步执行所有已配置渠道（等待全部完成；任何渠道异常都被吞掉）。
 */
export async function runNotificationChannels(
  content: NotificationContent,
  options: NotificationDispatchOptions = {},
): Promise<NotificationChannelResult> {
  const [webhook, email, sms] = await Promise.all([
    sendWebhookChannel(content, options).catch(() => ({ sent: false, skipped: true }) as NotificationChannelResult['webhook']),
    sendNotificationEmail({ title: content.title, body: content.body, data: content.data }).catch(
      () => false,
    ),
    sendNotificationSms({ content: `${content.title}：${content.body}` }).catch(() => null),
  ])

  return {
    webhook,
    email: { sent: email === true, skipped: email === false },
    sms: sms ?? { sent: 0, failed: 0, skipped: true },
  }
}

/**
 * Fire-and-forget 分发：不阻塞主业务，失败仅打印告警。
 */
export function dispatchNotification(content: NotificationContent): void {
  void runNotificationChannels(content).catch((error) => {
    console.warn(
      '[notify] 通知分发异常:',
      error instanceof Error ? error.message : String(error),
    )
  })
}
