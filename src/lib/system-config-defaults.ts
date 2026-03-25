import { config as appConfig } from '../config'

export type SystemConfigSeed = {
  key: string
  value: string | number | string[]
  description: string
}

type BuildDefaultSystemConfigsOptions = {
  nodeEnv?: string
  jwtSecretEnv?: string
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

  return [
    {
      key: 'allowedIPs',
      value: appConfig.security.allowedIPs,
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

export const defaultConfigValues = Object.fromEntries(
  defaultSystemConfigs.map(({ key, value }) => [key, value]),
) as Record<string, string | number | string[]>

export function stringifyConfigValue(value: string | number | string[]) {
  return typeof value === 'string' ? value : JSON.stringify(value)
}
