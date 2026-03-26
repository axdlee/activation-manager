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

export class InvalidSystemConfigPayloadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidSystemConfigPayloadError'
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
    throw new InvalidSystemConfigPayloadError(`系统配置 ${key} 必须是字符串`)
  }

  const normalizedValue = value.trim()
  if (!normalizedValue) {
    throw new InvalidSystemConfigPayloadError(`系统配置 ${key} 不能为空`)
  }

  return normalizedValue
}

function normalizeAllowedIps(value: SystemConfigValue) {
  if (!Array.isArray(value)) {
    throw new InvalidSystemConfigPayloadError('系统配置 allowedIPs 必须是字符串数组')
  }

  const normalizedValue = Array.from(
    new Set(value.map((item) => String(item).trim()).filter(Boolean)),
  )

  if (normalizedValue.length === 0) {
    throw new InvalidSystemConfigPayloadError('系统配置 allowedIPs 至少需要保留一个 IP 地址')
  }

  return normalizedValue
}

function normalizeJwtExpiresIn(value: SystemConfigValue) {
  const normalizedValue = ensureStringValue('jwtExpiresIn', value)

  if (!allowedJwtExpiryValues.has(normalizedValue)) {
    throw new InvalidSystemConfigPayloadError(
      `系统配置 jwtExpiresIn 仅支持以下值：${Array.from(allowedJwtExpiryValues).join('、')}`,
    )
  }

  return normalizedValue
}

function normalizeBcryptRounds(value: SystemConfigValue) {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new InvalidSystemConfigPayloadError('系统配置 bcryptRounds 必须是整数')
  }

  if (value < 4 || value > 15) {
    throw new InvalidSystemConfigPayloadError('系统配置 bcryptRounds 必须在 4 到 15 之间')
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

  throw new InvalidSystemConfigPayloadError(`系统配置 ${key} 必须是布尔值`)
}

function normalizeAutoRebindCooldownMinutes(value: SystemConfigValue) {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new InvalidSystemConfigPayloadError('系统配置 autoRebindCooldownMinutes 必须是整数')
  }

  if (
    value < AUTO_REBIND_COOLDOWN_MINUTES_MIN ||
    value > AUTO_REBIND_COOLDOWN_MINUTES_MAX
  ) {
    throw new InvalidSystemConfigPayloadError(
      `系统配置 autoRebindCooldownMinutes 必须在 ${AUTO_REBIND_COOLDOWN_MINUTES_MIN} 到 ${AUTO_REBIND_COOLDOWN_MINUTES_MAX} 之间`,
    )
  }

  return value
}

function normalizeAutoRebindMaxCount(value: SystemConfigValue) {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new InvalidSystemConfigPayloadError('系统配置 autoRebindMaxCount 必须是整数')
  }

  if (value < AUTO_REBIND_MAX_COUNT_MIN || value > AUTO_REBIND_MAX_COUNT_MAX) {
    throw new InvalidSystemConfigPayloadError(
      `系统配置 autoRebindMaxCount 必须在 ${AUTO_REBIND_MAX_COUNT_MIN} 到 ${AUTO_REBIND_MAX_COUNT_MAX} 之间`,
    )
  }

  return value
}

function normalizeSystemConfigValue(key: string, value: SystemConfigValue): SystemConfigValue {
  switch (key) {
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
    default:
      throw new InvalidSystemConfigPayloadError(`不支持写入系统配置项：${key}`)
  }
}

function normalizeSystemConfigUpdate(config: PersistableSystemConfigItem): PersistableSystemConfigItem {
  if (!writableSystemConfigKeySet.has(config.key)) {
    throw new InvalidSystemConfigPayloadError(`不支持写入系统配置项：${config.key}`)
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
      throw new InvalidSystemConfigPayloadError(`系统配置 ${config.key} 在同一次提交中重复出现`)
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
