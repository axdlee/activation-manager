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
}

export function stringifyConfigValue(value: string | number | boolean | string[]) {
  return typeof value === 'string' ? value : JSON.stringify(value)
}
