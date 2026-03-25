import { prisma } from './db'
import {
  defaultConfigValues,
  type KnownSystemConfigKey,
  type KnownSystemConfigMap,
} from './system-config-defaults'
import { type SystemConfigItem, type SystemConfigValue } from './system-config-ui'
import { isSensitiveSystemConfigKey } from './system-config-rules'

type CachedSystemConfigValue = SystemConfigValue | null

// 配置缓存
let configCache: Record<string, CachedSystemConfigValue | undefined> = {}
let cacheExpiry = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5分钟缓存

export function clearConfigCache(keys?: string[]) {
  if (!keys || keys.length === 0) {
    configCache = {}
    cacheExpiry = 0
    return
  }

  keys.forEach((key) => {
    delete configCache[key]
  })

  if (Object.keys(configCache).length === 0) {
    cacheExpiry = 0
  }
}

export class MissingRequiredSystemConfigError extends Error {
  constructor(key: string) {
    super(`系统配置缺失：${key} 未配置，生产环境禁止回退到仓库默认值`)
    this.name = 'MissingRequiredSystemConfigError'
  }
}

function isKnownSystemConfigKey(key: string): key is KnownSystemConfigKey {
  return key in defaultConfigValues
}

function normalizeKnownSystemConfigValue<K extends KnownSystemConfigKey>(
  key: K,
  value: SystemConfigValue,
): KnownSystemConfigMap[K] {
  switch (key) {
    case 'allowedIPs':
      return (
        Array.isArray(value)
          ? value.map((item) => String(item))
          : String(value)
            .split(/[\n,]/)
            .map((item) => item.trim())
            .filter(Boolean)
      ) as KnownSystemConfigMap[K]
    case 'bcryptRounds':
      return Number(value) as KnownSystemConfigMap[K]
    default:
      return String(value) as KnownSystemConfigMap[K]
  }
}

function parseConfigValue(rawValue: string): SystemConfigValue {
  try {
    return JSON.parse(rawValue)
  } catch {
    return rawValue
  }
}

export async function getConfig<K extends KnownSystemConfigKey>(key: K): Promise<KnownSystemConfigMap[K] | null>
export async function getConfig(key: string): Promise<SystemConfigValue | null>
export async function getConfig(key: string) {
  // 检查缓存
  if (Date.now() < cacheExpiry && configCache[key] !== undefined) {
    const cachedValue = configCache[key]
    return cachedValue !== null && isKnownSystemConfigKey(key)
      ? normalizeKnownSystemConfigValue(key, cachedValue)
      : cachedValue
  }

  // 从数据库获取配置
  const config = await prisma.systemConfig.findUnique({
    where: { key }
  })

  if (!config) {
    return null
  }

  const value = parseConfigValue(config.value)

  // 更新缓存
  configCache[key] = value
  if (!cacheExpiry || Date.now() >= cacheExpiry) {
    cacheExpiry = Date.now() + CACHE_DURATION
  }

  return isKnownSystemConfigKey(key)
    ? normalizeKnownSystemConfigValue(key, value)
    : value
}

export async function setConfig(
  key: string,
  value: SystemConfigValue,
  description?: string,
): Promise<void> {
  const stringValue = typeof value === 'string' ? value : JSON.stringify(value)
  
  await prisma.systemConfig.upsert({
    where: { key },
    update: { 
      value: stringValue,
      ...(description && { description })
    },
    create: { 
      key, 
      value: stringValue,
      description: description || ''
    }
  })

  // 清除缓存
  clearConfigCache([key])
}

export async function getAllConfigs(): Promise<Record<string, SystemConfigValue>> {
  const configs = await prisma.systemConfig.findMany()
  const result: Record<string, SystemConfigValue> = {}

  for (const config of configs) {
    result[config.key] = parseConfigValue(config.value)
  }

  return result
}

function hasConfigValue(value: SystemConfigValue) {
  if (Array.isArray(value)) {
    return value.length > 0
  }

  if (typeof value === 'string') {
    return value.trim() !== ''
  }

  return true
}

type ResolveConfigValueWithFallbackOptions = {
  nodeEnv?: string
}

function shouldFailFastForConfigValue(key: string, value: unknown, nodeEnv: string) {
  return (
    isSensitiveSystemConfigKey(key) &&
    nodeEnv === 'production' &&
    (value === null || (typeof value === 'string' && value.trim() === ''))
  )
}

export function resolveConfigValueWithFallback(
  key: KnownSystemConfigKey,
  value: KnownSystemConfigMap[KnownSystemConfigKey] | null,
  options?: ResolveConfigValueWithFallbackOptions,
): KnownSystemConfigMap[KnownSystemConfigKey]
export function resolveConfigValueWithFallback(
  key: string,
  value: SystemConfigValue | null,
  options?: ResolveConfigValueWithFallbackOptions,
): SystemConfigValue | null
export function resolveConfigValueWithFallback(
  key: string,
  value: SystemConfigValue | null,
  options: ResolveConfigValueWithFallbackOptions = {},
) {
  const nodeEnv = options.nodeEnv || process.env.NODE_ENV || 'development'

  if (shouldFailFastForConfigValue(key, value, nodeEnv)) {
    throw new MissingRequiredSystemConfigError(key)
  }

  if (value !== null) {
    return value
  }

  return isKnownSystemConfigKey(key) ? defaultConfigValues[key] : value
}

export function sanitizeSystemConfigsForAdmin(configs: SystemConfigItem[]): SystemConfigItem[] {
  return configs.map((config) => {
    if (!isSensitiveSystemConfigKey(config.key)) {
      return config
    }

    return {
      ...config,
      value: '',
      sensitive: true,
      masked: true,
      hasValue: hasConfigValue(config.value),
    }
  })
}

export async function getAllConfigsWithMeta(): Promise<SystemConfigItem[]> {
  const configs = await prisma.systemConfig.findMany({
    orderBy: { key: 'asc' }
  })

  return configs.map((config) => ({
    key: config.key,
    description: config.description,
    value: parseConfigValue(config.value),
  }))
}

export async function getConfigWithDefault<K extends KnownSystemConfigKey>(key: K): Promise<KnownSystemConfigMap[K]>
export async function getConfigWithDefault(key: string): Promise<SystemConfigValue | null>
export async function getConfigWithDefault(key: string) {
  const value = await getConfig(key)
  return resolveConfigValueWithFallback(key, value)
}
