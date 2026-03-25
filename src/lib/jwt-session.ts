import { getConfigWithDefault } from './config-service'

const jwtDurationUnitSecondsMap = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 24 * 60 * 60,
  w: 7 * 24 * 60 * 60,
} as const

export function parseJwtExpiresInToSeconds(expiresIn: string) {
  const normalizedExpiresIn = expiresIn.trim().toLowerCase()
  const match = normalizedExpiresIn.match(/^(\d+)([smhdw])$/)

  if (!match) {
    throw new Error(`不支持的 JWT 有效期格式: ${expiresIn}`)
  }

  const [, value, unit] = match
  return Number(value) * jwtDurationUnitSecondsMap[unit as keyof typeof jwtDurationUnitSecondsMap]
}

export async function getJwtSessionCookieMaxAge() {
  const jwtExpiresIn = await getConfigWithDefault('jwtExpiresIn')

  if (typeof jwtExpiresIn !== 'string') {
    throw new Error(`系统配置错误：jwtExpiresIn 必须为字符串，当前为 ${typeof jwtExpiresIn}`)
  }

  return parseJwtExpiresInToSeconds(jwtExpiresIn)
}
