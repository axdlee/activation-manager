import { isIP } from 'node:net'

import { getConfigWithDefault, MissingRequiredSystemConfigError } from './config-service'
import { verifyToken } from './jwt'
import { prisma } from './db'
import {
  type AdminAuthFailureCode,
  type AdminJwtPayload,
  type AdminAuthMode,
  type AdminAuthResult,
} from './admin-auth-shared'

type RequestLike = {
  ip?: string | null
  headers: {
    get(name: string): string | null
  }
  cookies: {
    get(name: string): { value: string } | undefined
  }
}

type AuthorizeAdminRequestOptions = {
  mode?: AdminAuthMode
  nodeEnv?: string
}

type AuthorizeAdminRequestDependencies = {
  getAllowedIPs: () => Promise<unknown>
  verifyToken: (token: string) => Promise<AdminJwtPayload | null>
  /** 返回当前令牌版本；账户不存在返回 null（跳过版本校验，兼容 dev 兜底令牌）；可选，缺省跳过 */
  getTokenVersion?: (username: string) => Promise<number | null>
}

function buildAuthFailure(
  code: AdminAuthFailureCode,
  error: string,
  status: 401 | 403 | 500,
): AdminAuthResult {
  return {
    success: false,
    code,
    error,
    status,
  }
}

function normalizeAllowedIPs(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }

  if (typeof value === 'string') {
    return value
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return []
}

function resolveAllowedIPsEnvOverride(allowedIPsEnv: string | undefined = process.env.ALLOWED_IPS) {
  const normalizedAllowedIPs = normalizeAllowedIPs(allowedIPsEnv)
  return normalizedAllowedIPs.length > 0 ? normalizedAllowedIPs : null
}

import { extractClientIp } from './client-ip'

export { extractClientIp }

function isIpAllowed(clientIp: string, allowedIPs: string[], nodeEnv: string) {
  if (nodeEnv !== 'production') {
    return true
  }

  return allowedIPs.some((allowedIpRule) => {
    const normalizedRule = allowedIpRule.trim()

    if (!normalizedRule) {
      return false
    }

    if (normalizedRule === '*') {
      return true
    }

    if (normalizedRule === '0.0.0.0') {
      return isIP(clientIp) === 4
    }

    if (normalizedRule === '::') {
      return isIP(clientIp) === 6
    }

    if (normalizedRule === clientIp) {
      return true
    }

    return matchesIpv4Cidr(clientIp, normalizedRule)
  })
}

function matchesIpv4Cidr(clientIp: string, rule: string) {
  const [network, prefixText] = rule.split('/')
  const prefix = Number(prefixText)

  if (
    !rule.includes('/') ||
    isIP(clientIp) !== 4 ||
    isIP(network) !== 4 ||
    !Number.isInteger(prefix) ||
    prefix < 0 ||
    prefix > 32
  ) {
    return false
  }

  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0

  return (ipv4ToInt(clientIp) & mask) === (ipv4ToInt(network) & mask)
}

function ipv4ToInt(ip: string) {
  return ip
    .split('.')
    .map((segment) => Number(segment))
    .reduce((result, segment) => ((result << 8) | segment) >>> 0, 0)
}

function isDynamicServerUsageError(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  const dynamicError = error as Error & { digest?: string }
  return (
    dynamicError.digest === 'DYNAMIC_SERVER_USAGE' ||
    error.message.includes('Dynamic server usage')
  )
}

export async function authorizeAdminRequest(
  request: RequestLike,
  options: AuthorizeAdminRequestOptions = {},
  dependencies: AuthorizeAdminRequestDependencies = {
    getAllowedIPs: () => getConfigWithDefault('allowedIPs'),
    verifyToken,
    getTokenVersion: async (username) =>
      (
        await prisma.admin.findUnique({
          where: { username },
          select: { tokenVersion: true },
        })
      )?.tokenVersion ?? null,
  },
): Promise<AdminAuthResult> {
  const mode = options.mode || 'protected'
  const nodeEnv = options.nodeEnv || process.env.NODE_ENV || 'development'

  try {
    const clientIp = extractClientIp(request)
    const allowedIPs =
      resolveAllowedIPsEnvOverride() ?? normalizeAllowedIPs(await dependencies.getAllowedIPs())

    if (!isIpAllowed(clientIp, allowedIPs, nodeEnv)) {
      return buildAuthFailure('ip_not_allowed', '访问被拒绝: IP地址不在白名单中', 403)
    }

    if (mode === 'public') {
      return { success: true }
    }

    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return buildAuthFailure('token_missing', '未提供认证令牌', 401)
    }

    const payload = await dependencies.verifyToken(token)
    if (!payload) {
      return buildAuthFailure('token_invalid', '无效的认证令牌', 401)
    }

    // 令牌版本校验：改密后 tokenVersion 自增，旧令牌立即失效
    // （getTokenVersion 缺省时跳过，兼容测试注入的最小依赖集）
    if (payload.username && dependencies.getTokenVersion) {
      const currentVersion = await dependencies.getTokenVersion(payload.username)
      if (currentVersion !== null && (payload.tokenVersion ?? 0) !== currentVersion) {
        return buildAuthFailure('token_invalid', '认证令牌已失效，请重新登录', 401)
      }
    }

    return {
      success: true,
      payload,
    }
  } catch (error) {
    if (error instanceof MissingRequiredSystemConfigError) {
      return buildAuthFailure('config_missing', error.message, 500)
    }

    if (!isDynamicServerUsageError(error)) {
      console.error('认证验证失败:', error)
    }
    return buildAuthFailure('auth_failed', '认证验证失败', 500)
  }
}
