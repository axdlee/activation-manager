import { NextResponse, type NextRequest } from 'next/server'

import { createLicenseApiRateLimiter } from './license-api-rate-limit'

/**
 * Admin API 轻量内存限流（防暴力刷接口）。
 * 按 IP + 路径维度滑动窗口；阈值宽松（默认 300 次/分钟），
 * 主要防御异常高频请求与刷接口，不影响正常管理操作。
 */
const adminApiRateLimiter = createLicenseApiRateLimiter({
  maxRequests: Number(process.env.ADMIN_API_RATE_LIMIT_MAX) || 300,
  windowMs: Number(process.env.ADMIN_API_RATE_LIMIT_WINDOW_MS) || 60 * 1000,
})

export type AdminRateLimitGuardResult =
  | { allowed: true }
  | { allowed: false; response: NextResponse }

export function guardAdminApiRateLimit(
  request: NextRequest,
  path: string,
): AdminRateLimitGuardResult {
  const ip =
    (request as Request & { ip?: string }).ip ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'

  const result = adminApiRateLimiter.check(`${path}:${ip}`)
  if (result.allowed) {
    return { allowed: true }
  }

  return {
    allowed: false,
    response: NextResponse.json(
      {
        success: false,
        message: '请求过于频繁，请稍后重试',
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(result.retryAfterSeconds),
        },
      },
    ),
  }
}