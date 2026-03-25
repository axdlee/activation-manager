import { getConfigWithDefault, MissingRequiredSystemConfigError } from './config-service'
import { verifyToken } from './jwt'
import {
  type AdminAuthFailureCode,
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
  verifyToken: (token: string) => Promise<any>
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

export function extractClientIp(request: RequestLike) {
  return (
    request.ip ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'
  )
}

function isIpAllowed(clientIp: string, allowedIPs: string[], nodeEnv: string) {
  return nodeEnv !== 'production' || allowedIPs.includes(clientIp)
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
  },
): Promise<AdminAuthResult> {
  const mode = options.mode || 'protected'
  const nodeEnv = options.nodeEnv || process.env.NODE_ENV || 'development'

  try {
    const clientIp = extractClientIp(request)
    const allowedIPs = normalizeAllowedIPs(await dependencies.getAllowedIPs())

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
