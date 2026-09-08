import { getConfigWithDefault } from './config-service'

/**
 * 邮件通知渠道（SMTP / nodemailer）：
 * - 配置来源：系统配置 notifyEmailSmtp* 系列
 * - 未配置 host 或收件人时视为未启用，直接跳过
 * - transporter 通过工厂创建，测试可注入 fake 实现避免真实 SMTP
 */

export type MailTransporterLike = {
  sendMail(options: Record<string, unknown>): Promise<unknown>
}

export type MailTransportOptions = {
  host: string
  port: number
  secure: boolean
  auth?: { user: string; pass: string }
}

export type MailTransportFactory = (options: MailTransportOptions) => MailTransporterLike

export type EmailNotificationConfig = {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  from: string
  recipients: string[]
}

let transportFactoryOverride: MailTransportFactory | null = null

/** 仅测试使用：注入 fake transport 工厂；传 null 恢复默认（nodemailer） */
export function setEmailTransportFactoryForTests(factory: MailTransportFactory | null) {
  transportFactoryOverride = factory
}

function splitRecipients(value: string) {
  return value
    .split(/[\n,;]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export async function getEmailNotificationConfig(): Promise<EmailNotificationConfig | null> {
  const host = String(await getConfigWithDefault('notifyEmailSmtpHost') ?? '').trim()
  const toRaw = String(await getConfigWithDefault('notifyEmailTo') ?? '').trim()
  const recipients = splitRecipients(toRaw)

  if (!host || recipients.length === 0) {
    return null
  }

  const portValue = Number(await getConfigWithDefault('notifyEmailSmtpPort'))
  const port = Number.isInteger(portValue) && portValue >= 1 && portValue <= 65535 ? portValue : 465

  return {
    host,
    port,
    secure: port === 465,
    user: String(await getConfigWithDefault('notifyEmailSmtpUser') ?? '').trim(),
    pass: String(await getConfigWithDefault('notifyEmailSmtpPass') ?? '').trim(),
    from: String(await getConfigWithDefault('notifyEmailFrom') ?? '').trim(),
    recipients,
  }
}

export function isEmailNotificationConfigured(config: EmailNotificationConfig | null) {
  return config !== null && Boolean(config.host) && config.recipients.length > 0
}

async function createTransporter(config: EmailNotificationConfig): Promise<MailTransporterLike> {
  if (transportFactoryOverride) {
    return transportFactoryOverride({
      host: config.host,
      port: config.port,
      secure: config.secure,
      ...(config.user && config.pass ? { auth: { user: config.user, pass: config.pass } } : {}),
    })
  }

  const nodemailer = (await import('nodemailer')) as unknown as {
    createTransport(options: MailTransportOptions): MailTransporterLike
  }
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    ...(config.user && config.pass ? { auth: { user: config.user, pass: config.pass } } : {}),
  })
}

export type SendEmailInput = {
  to: string[]
  subject: string
  text: string
}

/**
 * 发送一封通知邮件（等待完成，失败返回 false 不抛异常）。
 */
export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const config = await getEmailNotificationConfig()
  if (!isEmailNotificationConfigured(config) || !config) {
    return false
  }

  const from = config.from || (config.user ? `"Activation Manager" <${config.user}>` : 'Activation Manager')

  try {
    const transporter = await createTransporter(config)
    await transporter.sendMail({
      from,
      to: input.to.join(','),
      subject: input.subject,
      text: input.text,
    })
    return true
  } catch (error) {
    console.warn(
      '[notify] 邮件通知发送失败:',
      error instanceof Error ? error.message : String(error),
    )
    return false
  }
}

/**
 * 管理员通知邮件：正文 = 标题 + 摘要 + 结构化数据。
 */
export async function sendNotificationEmail(params: {
  title: string
  body: string
  data?: Record<string, unknown>
}): Promise<boolean> {
  const config = await getEmailNotificationConfig()
  if (!isEmailNotificationConfigured(config)) {
    return false
  }

  const dataSection = params.data ? `\n\n----\n${JSON.stringify(params.data, null, 2)}` : ''
  return sendEmail({
    to: config?.recipients ?? [],
    subject: params.title,
    text: `${params.body}${dataSection}`,
  })
}
