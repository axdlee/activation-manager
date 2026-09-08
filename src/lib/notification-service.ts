import { getConfigWithDefault } from './config-service'
import { prisma } from './db'
import {
  getEmailNotificationConfig,
  isEmailNotificationConfigured,
  sendNotificationEmail,
} from './notification-email'
import {
  getSmsNotificationConfig,
  isSmsNotificationConfigured,
  sendNotificationSms,
} from './notification-sms'

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
  webhook: { sent: boolean; target?: string; viaLegacyExpiryWebhook?: boolean; skipped?: boolean }
  email: { sent: boolean; attempted: boolean; target?: string }
  sms: { sent: number; failed: number; attempted: boolean; target?: string }
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
    return {
      ...(await postJson(genericUrl, buildNotificationEnvelope(content))),
      target: genericUrl,
    }
  }

  // 回落：到期事件走旧「到期通知接口」，保持原始扁平 payload 结构（向后兼容）
  if (content.event === NOTIFICATION_EVENTS.LICENSE_EXPIRED) {
    const legacyUrl =
      options.legacyExpiryWebhookUrl !== undefined
        ? normalizeHttpUrl(options.legacyExpiryWebhookUrl)
        : await getLegacyExpiryWebhookUrl()
    if (legacyUrl) {
      const result = await postJson(legacyUrl, content.data)
      return { ...result, target: legacyUrl, viaLegacyExpiryWebhook: true }
    }
  }

  return { sent: false, skipped: true }
}

/**
 * 同步执行所有已配置渠道（等待全部完成；任何渠道异常都被吞掉），
 * 并把每次实际投递（非跳过）写入 notification_logs。
 */
export async function runNotificationChannels(
  content: NotificationContent,
  options: NotificationDispatchOptions = {},
): Promise<NotificationChannelResult> {
  const [webhook, emailConfig, smsConfig] = await Promise.all([
    sendWebhookChannel(content, options).catch(() => ({ sent: false, skipped: true }) as NotificationChannelResult['webhook']),
    getEmailNotificationConfig(),
    getSmsNotificationConfig(),
  ])

  const emailAttempted = isEmailNotificationConfigured(emailConfig)
  const smsAttempted = isSmsNotificationConfigured(smsConfig)

  const [emailSent, sms] = await Promise.all([
    emailAttempted
      ? sendNotificationEmail({ title: content.title, body: content.body, data: content.data }).catch(() => false)
      : Promise.resolve(false),
    smsAttempted
      ? sendNotificationSms({ content: `${content.title}：${content.body}` }).catch(() => null)
      : Promise.resolve(null),
  ])

  const result: NotificationChannelResult = {
    webhook,
    email: {
      sent: emailSent === true,
      attempted: emailAttempted,
      target: emailAttempted ? (emailConfig?.recipients ?? []).join(',') : undefined,
    },
    sms: smsAttempted && sms
      ? { ...sms, attempted: true, target: (smsConfig?.phones ?? []).join(',') }
      : { sent: 0, failed: 0, attempted: false },
  }

  await persistNotificationLogs(content, result)

  return result
}

/**
 * 通知投递日志：每个渠道一条（仅记录实际尝试的投递）。
 * 日志写入失败不影响通知结果，也不抛出。
 */
async function persistNotificationLogs(
  content: NotificationContent,
  result: NotificationChannelResult,
): Promise<void> {
  const data = (content.data ?? {}) as Record<string, unknown>
  const relatedId =
    (typeof data.orderNo === 'string' ? data.orderNo : undefined) ??
    (typeof data.code === 'string' ? data.code : undefined) ??
    (Array.isArray(data.orderNos) ? (data.orderNos as string[]).join(',') : undefined)

  const envelope = JSON.stringify(buildNotificationEnvelope(content))
  const rows: Array<{
    event: string
    channel: string
    target: string
    status: string
    error?: string
    relatedId?: string
    payload?: string
  }> = []

  if (!result.webhook.skipped) {
    rows.push({
      event: content.event,
      channel: 'webhook',
      target: result.webhook.target ?? '',
      status: result.webhook.sent ? 'sent' : 'failed',
      error: result.webhook.sent ? undefined : 'webhook 返回非 2xx 或网络异常',
      relatedId,
      payload: envelope,
    })
  }

  if (result.email.attempted) {
    rows.push({
      event: content.event,
      channel: 'email',
      target: result.email.target ?? '',
      status: result.email.sent ? 'sent' : 'failed',
      error: result.email.sent ? undefined : 'SMTP 发送失败',
      relatedId,
      payload: envelope,
    })
  }

  if (result.sms.attempted) {
    rows.push({
      event: content.event,
      channel: 'sms',
      target: result.sms.target ?? '',
      status: result.sms.failed === 0 ? 'sent' : result.sms.sent > 0 ? 'partial' : 'failed',
      error: result.sms.failed > 0 ? `${result.sms.failed} 个号码发送失败` : undefined,
      relatedId,
      payload: envelope,
    })
  }

  if (rows.length === 0) {
    return
  }

  try {
    await prisma.notificationLog.createMany({ data: rows })
  } catch (error) {
    console.warn(
      '[notify] 通知日志写入失败:',
      error instanceof Error ? error.message : String(error),
    )
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
