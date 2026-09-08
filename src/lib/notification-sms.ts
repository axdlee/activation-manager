import { getConfigWithDefault } from './config-service'

/**
 * 短信通知渠道（通用 HTTP 网关）：
 * - 不绑定具体短信服务商，通过「请求体模板」适配任意 HTTP 短信网关
 *   （阿里云短信助手 / 短信宝 / 自建网关等支持 HTTP 提交的服务商）
 * - 模板占位符：{phone} = 接收手机号，{content} = 通知内容
 * - 默认模板为 JSON：{"phone":"{phone}","content":"{content}"}
 * - 未配置网关地址或接收手机号时视为未启用，直接跳过
 */

export const DEFAULT_SMS_BODY_TEMPLATE = '{"phone":"{phone}","content":"{content}"}'

export type SmsNotificationConfig = {
  apiUrl: string
  bodyTemplate: string
  phones: string[]
}

function splitPhones(value: string) {
  return value
    .split(/[\n,;]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export async function getSmsNotificationConfig(): Promise<SmsNotificationConfig | null> {
  const apiUrl = String(await getConfigWithDefault('notifySmsApiUrl') ?? '').trim()
  const phones = splitPhones(String(await getConfigWithDefault('notifySmsPhones') ?? ''))

  if (!apiUrl || phones.length === 0) {
    return null
  }

  const bodyTemplate =
    String(await getConfigWithDefault('notifySmsApiBody') ?? '').trim() || DEFAULT_SMS_BODY_TEMPLATE

  return { apiUrl, bodyTemplate, phones }
}

export function isSmsNotificationConfigured(config: SmsNotificationConfig | null) {
  return config !== null && Boolean(config.apiUrl) && config.phones.length > 0
}

export function renderSmsBody(template: string, phone: string, content: string) {
  return template.split('{phone}').join(phone).split('{content}').join(content)
}

export type SmsSendResult = {
  sent: number
  failed: number
}

/**
 * 向所有配置的手机号发送通知短信（并行，单号 5s 超时）。
 * 返回成功/失败条数；网络异常计入失败，不抛异常。
 */
export async function sendNotificationSms(params: {
  content: string
  config?: SmsNotificationConfig
}): Promise<SmsSendResult> {
  const config = params.config ?? (await getSmsNotificationConfig())
  if (!isSmsNotificationConfigured(config) || !config) {
    return { sent: 0, failed: 0 }
  }

  const fetcher = globalThis.fetch
  if (!fetcher) {
    return { sent: 0, failed: config.phones.length }
  }

  const results = await Promise.all(
    config.phones.map(async (phone) => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)

      try {
        const response = await fetcher(config.apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: renderSmsBody(config.bodyTemplate, phone, params.content),
          signal: controller.signal,
        })

        if (!response.ok) {
          console.warn(`[notify] 短信网关返回非 2xx: ${response.status}（${phone}）`)
          return false
        }
        return true
      } catch (error) {
        console.warn(
          `[notify] 短信网关发送失败（${phone}）:`,
          error instanceof Error ? error.message : String(error),
        )
        return false
      } finally {
        clearTimeout(timeout)
      }
    }),
  )

  return {
    sent: results.filter(Boolean).length,
    failed: results.filter((result) => !result).length,
  }
}
