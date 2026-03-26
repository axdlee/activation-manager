import { config as appConfig } from '../config'

export type KnownSystemConfigMap = {
  allowedIPs: string[]
  jwtSecret: string
  jwtExpiresIn: string
  bcryptRounds: number
  systemName: string
}

export type KnownSystemConfigKey = keyof KnownSystemConfigMap

export type SystemConfigSeed = {
  key: KnownSystemConfigKey
  value: string | number | string[]
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
}

export function stringifyConfigValue(value: string | number | string[]) {
  return typeof value === 'string' ? value : JSON.stringify(value)
}
