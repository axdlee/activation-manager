import { clearConfigCache } from './config-service'
import { prisma } from './db'
import {
  AUTO_REBIND_COOLDOWN_MINUTES_MAX,
  AUTO_REBIND_COOLDOWN_MINUTES_MIN,
  AUTO_REBIND_MAX_COUNT_MAX,
  AUTO_REBIND_MAX_COUNT_MIN,
} from './license-rebind-policy-shared'
import { stringifyConfigValue } from './system-config-defaults'
import { type PersistableSystemConfigItem } from './system-config-updates'
import { type SystemConfigValue } from './system-config-ui'

const writableSystemConfigKeySet = new Set([
  'allowedIPs',
  'allowAutoRebind',
  'autoRebindCooldownMinutes',
  'autoRebindMaxCount',
  'jwtSecret',
  'jwtExpiresIn',
  'bcryptRounds',
  'systemName',
  'expiryWebhookUrl',
  'allowDeviceBinding',
  'licenseResponseSecret',
  'shopEnabled',
  'notifyWebhookUrl',
  'notifyEmailSmtpHost',
  'notifyEmailSmtpPort',
  'notifyEmailSmtpUser',
  'notifyEmailSmtpPass',
  'notifyEmailFrom',
  'notifyEmailTo',
  'notifySmsApiUrl',
  'notifySmsApiBody',
  'notifySmsPhones',
])

const allowedJwtExpiryValues = new Set(['1h', '6h', '12h', '24h', '7d'])

type SystemConfigUpsertArgs = {
  where: { key: string }
  update: { value: string; description?: string }
  create: { key: string; value: string; description?: string }
}

type SystemConfigTransactionClient = {
  systemConfig: {
    upsert(args: SystemConfigUpsertArgs): Promise<unknown>
  }
}

type SystemConfigPersistenceClient = {
  $transaction<T>(callback: (tx: SystemConfigTransactionClient) => Promise<T>): Promise<T>
}

/**
 * 服务端系统配置校验错误。
 *
 * i18n 约定：
 * - `message` 始终是中文原文（向后兼容：未迁移的调用方直接展示 message 不变）
 * - `messageKey` 指向 server-messages 词典的 `sysconf.*` 键，route 层可用
 *   createServerT(locale).t(error.messageKey, error.messageParams) 按请求语言翻译
 */
export class InvalidSystemConfigPayloadError extends Error {
  readonly messageKey?: string
  readonly messageParams?: Record<string, string | number>

  constructor(message: string, messageKey?: string, messageParams?: Record<string, string | number>) {
    super(message)
    this.name = 'InvalidSystemConfigPayloadError'
    this.messageKey = messageKey
    this.messageParams = messageParams
  }
}

function normalizeDescription(description?: string) {
  if (description === undefined) {
    return undefined
  }

  const normalizedDescription = description.trim()
  return normalizedDescription || undefined
}

function ensureStringValue(key: string, value: SystemConfigValue) {
  if (typeof value !== 'string') {
    throw new InvalidSystemConfigPayloadError(`系统配置 ${key} 必须是字符串`, 'sysconf.mustBeString', { key })
  }

  const normalizedValue = value.trim()
  if (!normalizedValue) {
    throw new InvalidSystemConfigPayloadError(`系统配置 ${key} 不能为空`, 'sysconf.cannotBeEmpty', { key })
  }

  return normalizedValue
}

// 允许为空的字符串配置（如到期通知接口，空表示未配置）
function ensureOptionalStringValue(key: string, value: SystemConfigValue) {
  if (typeof value !== 'string') {
    throw new InvalidSystemConfigPayloadError(`系统配置 ${key} 必须是字符串`, 'sysconf.mustBeString', { key })
  }

  return value.trim()
}

function normalizeAllowedIps(value: SystemConfigValue) {
  if (!Array.isArray(value)) {
    throw new InvalidSystemConfigPayloadError(
      '系统配置 allowedIPs 必须是字符串数组',
      'sysconf.allowedIPsMustBeArray',
    )
  }

  const normalizedValue = Array.from(
    new Set(value.map((item) => String(item).trim()).filter(Boolean)),
  )

  if (normalizedValue.length === 0) {
    throw new InvalidSystemConfigPayloadError(
      '系统配置 allowedIPs 至少需要保留一个 IP 地址',
      'sysconf.allowedIPsAtLeastOne',
    )
  }

  return normalizedValue
}

function normalizeJwtExpiresIn(value: SystemConfigValue) {
  const normalizedValue = ensureStringValue('jwtExpiresIn', value)

  if (!allowedJwtExpiryValues.has(normalizedValue)) {
    throw new InvalidSystemConfigPayloadError(
      `系统配置 jwtExpiresIn 仅支持以下值：${Array.from(allowedJwtExpiryValues).join('、')}`,
      'sysconf.jwtExpiresInUnsupported',
      { values: Array.from(allowedJwtExpiryValues).join('、') },
    )
  }

  return normalizedValue
}

function normalizeBcryptRounds(value: SystemConfigValue) {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new InvalidSystemConfigPayloadError(
      '系统配置 bcryptRounds 必须是整数',
      'sysconf.mustBeInteger',
      { key: 'bcryptRounds' },
    )
  }

  if (value < 4 || value > 15) {
    throw new InvalidSystemConfigPayloadError(
      '系统配置 bcryptRounds 必须在 4 到 15 之间',
      'sysconf.bcryptRoundsRange',
    )
  }

  return value
}

function normalizeBooleanConfigValue(key: string, value: SystemConfigValue) {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'string') {
    if (value === 'true') {
      return true
    }

    if (value === 'false') {
      return false
    }
  }

  throw new InvalidSystemConfigPayloadError(`系统配置 ${key} 必须是布尔值`, 'sysconf.mustBeBoolean', { key })
}

function normalizeAutoRebindCooldownMinutes(value: SystemConfigValue) {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new InvalidSystemConfigPayloadError(
      '系统配置 autoRebindCooldownMinutes 必须是整数',
      'sysconf.mustBeInteger',
      { key: 'autoRebindCooldownMinutes' },
    )
  }

  if (
    value < AUTO_REBIND_COOLDOWN_MINUTES_MIN ||
    value > AUTO_REBIND_COOLDOWN_MINUTES_MAX
  ) {
    throw new InvalidSystemConfigPayloadError(
      `系统配置 autoRebindCooldownMinutes 必须在 ${AUTO_REBIND_COOLDOWN_MINUTES_MIN} 到 ${AUTO_REBIND_COOLDOWN_MINUTES_MAX} 之间`,
      'sysconf.valueRange',
      { key: 'autoRebindCooldownMinutes', min: AUTO_REBIND_COOLDOWN_MINUTES_MIN, max: AUTO_REBIND_COOLDOWN_MINUTES_MAX },
    )
  }

  return value
}

function normalizeAutoRebindMaxCount(value: SystemConfigValue) {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new InvalidSystemConfigPayloadError(
      '系统配置 autoRebindMaxCount 必须是整数',
      'sysconf.mustBeInteger',
      { key: 'autoRebindMaxCount' },
    )
  }

  if (value < AUTO_REBIND_MAX_COUNT_MIN || value > AUTO_REBIND_MAX_COUNT_MAX) {
    throw new InvalidSystemConfigPayloadError(
      `系统配置 autoRebindMaxCount 必须在 ${AUTO_REBIND_MAX_COUNT_MIN} 到 ${AUTO_REBIND_MAX_COUNT_MAX} 之间`,
      'sysconf.valueRange',
      { key: 'autoRebindMaxCount', min: AUTO_REBIND_MAX_COUNT_MIN, max: AUTO_REBIND_MAX_COUNT_MAX },
    )
  }

  return value
}

// 通用通知 Webhook：允许为空；非空时必须是 http/https URL
function normalizeNotifyWebhookUrl(value: SystemConfigValue) {
  const normalizedValue = ensureOptionalStringValue('notifyWebhookUrl', value)
  if (normalizedValue && !/^https?:\/\//i.test(normalizedValue)) {
    throw new InvalidSystemConfigPayloadError(
      '系统配置 notifyWebhookUrl 必须是 http/https 地址',
      'sysconf.notifyWebhookUrlProtocol',
    )
  }
  return normalizedValue
}

// 通知邮件 SMTP 端口：1-65535 整数
function normalizeNotifyEmailSmtpPort(value: SystemConfigValue) {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new InvalidSystemConfigPayloadError(
      '系统配置 notifyEmailSmtpPort 必须是整数',
      'sysconf.mustBeInteger',
      { key: 'notifyEmailSmtpPort' },
    )
  }

  if (value < 1 || value > 65535) {
    throw new InvalidSystemConfigPayloadError(
      '系统配置 notifyEmailSmtpPort 必须在 1 到 65535 之间',
      'sysconf.smtpPortRange',
    )
  }

  return value
}

function normalizeSystemConfigValue(key: string, value: SystemConfigValue): SystemConfigValue {  switch (key) {
    case 'allowedIPs':
      return normalizeAllowedIps(value)
    case 'allowAutoRebind':
      return normalizeBooleanConfigValue(key, value)
    case 'autoRebindCooldownMinutes':
      return normalizeAutoRebindCooldownMinutes(value)
    case 'autoRebindMaxCount':
      return normalizeAutoRebindMaxCount(value)
    case 'jwtSecret':
      return ensureStringValue(key, value)
    case 'jwtExpiresIn':
      return normalizeJwtExpiresIn(value)
    case 'bcryptRounds':
      return normalizeBcryptRounds(value)
    case 'systemName':
      return ensureStringValue(key, value)
    case 'expiryWebhookUrl':
      return ensureOptionalStringValue(key, value)
    case 'notifyWebhookUrl':
      return normalizeNotifyWebhookUrl(value)
    case 'notifyEmailSmtpHost':
    case 'notifyEmailSmtpUser':
    case 'notifyEmailSmtpPass':
    case 'notifyEmailFrom':
    case 'notifyEmailTo':
    case 'notifySmsApiUrl':
    case 'notifySmsApiBody':
    case 'notifySmsPhones':
      return ensureOptionalStringValue(key, value)
    case 'notifyEmailSmtpPort':
      return normalizeNotifyEmailSmtpPort(value)
    case 'licenseResponseSecret':
      return ensureOptionalStringValue(key, value)
    case 'shopEnabled':
      return normalizeBooleanConfigValue(key, value)
    case 'allowDeviceBinding':
      return normalizeBooleanConfigValue(key, value)
    default:
      throw new InvalidSystemConfigPayloadError(
        `不支持写入系统配置项：${key}`,
        'sysconf.notWritable',
        { key },
      )
  }
}

function normalizeSystemConfigUpdate(config: PersistableSystemConfigItem): PersistableSystemConfigItem {
  if (!writableSystemConfigKeySet.has(config.key)) {
    throw new InvalidSystemConfigPayloadError(
      `不支持写入系统配置项：${config.key}`,
      'sysconf.notWritable',
      { key: config.key },
    )
  }

  return {
    key: config.key,
    value: normalizeSystemConfigValue(config.key, config.value),
    description: normalizeDescription(config.description),
  }
}

export function normalizeSystemConfigUpdates(configs: PersistableSystemConfigItem[]) {
  const seenKeys = new Set<string>()

  return configs.map((config) => {
    if (seenKeys.has(config.key)) {
      throw new InvalidSystemConfigPayloadError(
        `系统配置 ${config.key} 在同一次提交中重复出现`,
        'sysconf.duplicateKey',
        { key: config.key },
      )
    }

    seenKeys.add(config.key)
    return normalizeSystemConfigUpdate(config)
  })
}

export async function persistSystemConfigUpdates(
  configs: PersistableSystemConfigItem[],
  client: SystemConfigPersistenceClient = prisma,
) {
  const normalizedConfigs = normalizeSystemConfigUpdates(configs)

  await client.$transaction(async (tx) => {
    for (const config of normalizedConfigs) {
      const serializedValue = stringifyConfigValue(config.value)

      await tx.systemConfig.upsert({
        where: { key: config.key },
        update: {
          value: serializedValue,
          ...(config.description !== undefined ? { description: config.description } : {}),
        },
        create: {
          key: config.key,
          value: serializedValue,
          description: config.description ?? '',
        },
      })
    }
  })

  clearConfigCache(normalizedConfigs.map((config) => config.key))

  return normalizedConfigs
}
