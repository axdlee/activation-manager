import { config as appConfig } from '../config'
import {
  DEFAULT_ALLOW_AUTO_REBIND,
  DEFAULT_AUTO_REBIND_COOLDOWN_MINUTES,
  DEFAULT_AUTO_REBIND_MAX_COUNT,
} from './license-rebind-policy-shared'

export type KnownSystemConfigMap = {
  allowedIPs: string[]
  jwtSecret: string
  jwtExpiresIn: string
  bcryptRounds: number
  systemName: string
  allowAutoRebind: boolean
  autoRebindCooldownMinutes: number
  autoRebindMaxCount: number
  expiryWebhookUrl: string
  allowDeviceBinding: boolean
  licenseResponseSecret: string
  shopEnabled: boolean
  notifyWebhookUrl: string
  notifyEmailSmtpHost: string
  notifyEmailSmtpPort: number
  notifyEmailSmtpUser: string
  notifyEmailSmtpPass: string
  notifyEmailFrom: string
  notifyEmailTo: string
  notifySmsApiUrl: string
  notifySmsApiBody: string
  notifySmsPhones: string
}

export type KnownSystemConfigKey = keyof KnownSystemConfigMap

export type SystemConfigSeed = {
  key: KnownSystemConfigKey
  value: string | number | boolean | string[]
  description: string
}

type BuildDefaultSystemConfigsOptions = {
  nodeEnv?: string
  jwtSecretEnv?: string
  allowedIPsEnv?: string
}

function resolveAllowedIpsSeed(allowedIPsEnv: string | undefined = process.env.ALLOWED_IPS) {
  if (!allowedIPsEnv) {
    return appConfig.security.allowedIPs
  }

  const normalizedAllowedIPs = Array.from(
    new Set(
      allowedIPsEnv
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  )

  return normalizedAllowedIPs.length > 0 ? normalizedAllowedIPs : appConfig.security.allowedIPs
}

export function resolveJwtSecretSeed(
  nodeEnv: string = process.env.NODE_ENV || 'development',
  jwtSecretEnv: string | undefined = process.env.JWT_SECRET,
) {
  if (nodeEnv !== 'production') {
    return appConfig.jwt.secret
  }

  const normalizedJwtSecretEnv = jwtSecretEnv?.trim()
  return normalizedJwtSecretEnv ? normalizedJwtSecretEnv : null
}

export function buildDefaultSystemConfigs(
  options: BuildDefaultSystemConfigsOptions = {},
): SystemConfigSeed[] {
  const nodeEnv = options.nodeEnv || process.env.NODE_ENV || 'development'
  const jwtSecretSeed = resolveJwtSecretSeed(nodeEnv, options.jwtSecretEnv)
  const allowedIpsSeed = resolveAllowedIpsSeed(options.allowedIPsEnv)

  return [
    {
      key: 'allowedIPs',
      value: allowedIpsSeed,
      description: 'IP白名单列表',
    },
    {
      key: 'allowAutoRebind',
      value: DEFAULT_ALLOW_AUTO_REBIND,
      description: '是否允许激活码在满足条件时自动换绑',
    },
    {
      key: 'autoRebindCooldownMinutes',
      value: DEFAULT_AUTO_REBIND_COOLDOWN_MINUTES,
      description: '激活码自动换绑冷却时间（分钟）',
    },
    {
      key: 'autoRebindMaxCount',
      value: DEFAULT_AUTO_REBIND_MAX_COUNT,
      description: '激活码最大自助换绑次数（0 表示不限制）',
    },
    ...(jwtSecretSeed
      ? [
          {
            key: 'jwtSecret',
            value: jwtSecretSeed,
            description: 'JWT密钥',
          } satisfies SystemConfigSeed,
        ]
      : []),
    {
      key: 'jwtExpiresIn',
      value: appConfig.jwt.expiresIn,
      description: 'JWT过期时间',
    },
    {
      key: 'bcryptRounds',
      value: appConfig.security.bcryptRounds,
      description: 'bcrypt加密强度',
    },
    {
      key: 'systemName',
      value: '激活码管理系统',
      description: '系统名称',
    },
    {
      key: 'expiryWebhookUrl',
      value: '',
      description: '激活码到期通知接口（POST JSON，留空表示不通知）',
    },
    {
      key: 'allowDeviceBinding',
      value: true,
      description: '是否允许激活码绑定设备（关闭后激活码不再绑定机器）',
    },
    {
      key: 'licenseResponseSecret',
      value: '',
      description: 'License API 响应签名密钥（留空不签名；配置后 SDK 可验签防篡改）',
    },
    {
      key: 'shopEnabled',
      value: true,
      description: '是否启用购买中心（商品、下单、支付自动发卡）',
    },
    {
      key: 'notifyWebhookUrl',
      value: '',
      description: '通用通知 Webhook（到期/发卡/超时取消等事件 POST JSON；留空不通知）',
    },
    {
      key: 'notifyEmailSmtpHost',
      value: '',
      description: '通知邮件 SMTP 服务器地址（留空不启用邮件通知）',
    },
    {
      key: 'notifyEmailSmtpPort',
      value: 465,
      description: '通知邮件 SMTP 端口（465=SSL，其他端口默认 STARTTLS/明文）',
    },
    {
      key: 'notifyEmailSmtpUser',
      value: '',
      description: '通知邮件 SMTP 用户名（与密码同时填写才启用认证）',
    },
    {
      key: 'notifyEmailSmtpPass',
      value: '',
      description: '通知邮件 SMTP 密码/授权码',
    },
    {
      key: 'notifyEmailFrom',
      value: '',
      description: '通知邮件发件人（留空默认使用 SMTP 用户名）',
    },
    {
      key: 'notifyEmailTo',
      value: '',
      description: '通知邮件收件人（逗号或换行分隔，可多个）',
    },
    {
      key: 'notifySmsApiUrl',
      value: '',
      description: '通知短信 HTTP 网关地址（留空不启用短信通知）',
    },
    {
      key: 'notifySmsApiBody',
      value: '',
      description: '通知短信请求体模板（{phone} 手机号 {content} 内容；留空用默认 JSON 模板）',
    },
    {
      key: 'notifySmsPhones',
      value: '',
      description: '通知短信接收手机号（逗号或换行分隔，可多个）',
    },
  ]
}

export const defaultSystemConfigs: SystemConfigSeed[] = buildDefaultSystemConfigs()

export const defaultConfigValues: KnownSystemConfigMap = {
  allowedIPs: appConfig.security.allowedIPs,
  jwtSecret: appConfig.jwt.secret,
  jwtExpiresIn: appConfig.jwt.expiresIn,
  bcryptRounds: appConfig.security.bcryptRounds,
  systemName: '激活码管理系统',
  allowAutoRebind: DEFAULT_ALLOW_AUTO_REBIND,
  autoRebindCooldownMinutes: DEFAULT_AUTO_REBIND_COOLDOWN_MINUTES,
  autoRebindMaxCount: DEFAULT_AUTO_REBIND_MAX_COUNT,
  expiryWebhookUrl: '',
  allowDeviceBinding: true,
  licenseResponseSecret: '',
  shopEnabled: true,
  notifyWebhookUrl: '',
  notifyEmailSmtpHost: '',
  notifyEmailSmtpPort: 465,
  notifyEmailSmtpUser: '',
  notifyEmailSmtpPass: '',
  notifyEmailFrom: '',
  notifyEmailTo: '',
  notifySmsApiUrl: '',
  notifySmsApiBody: '',
  notifySmsPhones: '',
}

export function stringifyConfigValue(value: string | number | boolean | string[]) {
  return typeof value === 'string' ? value : JSON.stringify(value)
}
