import { config as appConfig } from '../config'

export type SystemConfigSeed = {
  key: string
  value: string | number | string[]
  description: string
}

export const defaultSystemConfigs: SystemConfigSeed[] = [
  {
    key: 'allowedIPs',
    value: appConfig.security.allowedIPs,
    description: 'IP白名单列表',
  },
  {
    key: 'jwtSecret',
    value: appConfig.jwt.secret,
    description: 'JWT密钥',
  },
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

export const defaultConfigValues = Object.fromEntries(
  defaultSystemConfigs.map(({ key, value }) => [key, value]),
) as Record<string, string | number | string[]>

export function stringifyConfigValue(value: string | number | string[]) {
  return typeof value === 'string' ? value : JSON.stringify(value)
}
