import { prisma } from './db'
import { defaultConfigValues } from './system-config-defaults'
import { type SystemConfigItem, type SystemConfigValue } from './system-config-ui'
import { isSensitiveSystemConfigKey } from './system-config-rules'

// 配置缓存
let configCache: Record<string, any> = {}
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

export async function getConfig(key: string): Promise<any> {
  // 检查缓存
  if (Date.now() < cacheExpiry && configCache[key] !== undefined) {
    return configCache[key]
  }

  // 从数据库获取配置
  const config = await prisma.systemConfig.findUnique({
    where: { key }
  })

  if (!config) {
    return null
  }

  // 尝试解析JSON值
  let value: any
  try {
    value = JSON.parse(config.value)
  } catch {
    value = config.value
  }

  // 更新缓存
  configCache[key] = value
  if (!cacheExpiry || Date.now() >= cacheExpiry) {
    cacheExpiry = Date.now() + CACHE_DURATION
  }

  return value
}

export async function setConfig(key: string, value: any, description?: string): Promise<void> {
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

export async function getAllConfigs(): Promise<Record<string, any>> {
  const configs = await prisma.systemConfig.findMany()
  const result: Record<string, any> = {}

  for (const config of configs) {
    try {
      result[config.key] = JSON.parse(config.value)
    } catch {
      result[config.key] = config.value
    }
  }

  return result
}

function parseConfigValue(rawValue: string): SystemConfigValue {
  try {
    return JSON.parse(rawValue)
  } catch {
    return rawValue
  }
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
  key: string,
  value: unknown,
  options: ResolveConfigValueWithFallbackOptions = {},
) {
  const nodeEnv = options.nodeEnv || process.env.NODE_ENV || 'development'

  if (shouldFailFastForConfigValue(key, value, nodeEnv)) {
    throw new MissingRequiredSystemConfigError(key)
  }

  if (value !== null) {
    return value
  }

  return defaultConfigValues[key]
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

export async function getConfigWithDefault(key: string): Promise<any> {
  const value = await getConfig(key)
  return resolveConfigValueWithFallback(key, value)
}
