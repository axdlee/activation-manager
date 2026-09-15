import { NextRequest, NextResponse } from 'next/server'

import { createLicenseApiRateLimiter } from './license-api-rate-limit'

/**
 * 公开 Shop API（下单/查询/找回/回调）的轻量内存限流。
 * 与 License API 共用滑动窗口实现；单实例部署友好。
 */
const shopApiRateLimiter = createLicenseApiRateLimiter({
  maxRequests: Number(process.env.SHOP_API_RATE_LIMIT_MAX) || 60,
  windowMs: Number(process.env.SHOP_API_RATE_LIMIT_WINDOW_MS) || 60 * 1000,
})

export function buildShopApiRateLimitKey(request: NextRequest, path: string) {
  const ip =
    (request as Request & { ip?: string }).ip ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  return `${path}:${ip}`
}

export type ShopRateLimitGuardResult =
  | { allowed: true }
  | { allowed: false; response: NextResponse }

export function guardShopApiRateLimit(
  request: NextRequest,
  path: string,
): ShopRateLimitGuardResult {
  const result = shopApiRateLimiter.check(buildShopApiRateLimitKey(request, path))
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
