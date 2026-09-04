// 针对公开 License API 的轻量级内存限流器。
// 基于滑动窗口（IP + 路径维度），单实例部署友好。
// 多实例场景建议在反向代理层补充限流，或替换为共享存储实现。

export type LicenseApiRateLimitCheckResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number }

export type LicenseApiRateLimiter = {
  check(key: string): LicenseApiRateLimitCheckResult
}

export type LicenseApiRateLimiterOptions = {
  maxRequests?: number
  windowMs?: number
  now?: () => number
}

export const DEFAULT_LICENSE_API_MAX_REQUESTS = 120
export const DEFAULT_LICENSE_API_WINDOW_MS = 60 * 1000

function normalizeFailures(timestamps: number[], now: number, windowMs: number) {
  return timestamps.filter((t) => now - t < windowMs)
}

export function createLicenseApiRateLimiter(
  options: LicenseApiRateLimiterOptions = {},
): LicenseApiRateLimiter {
  const maxRequests = options.maxRequests ?? DEFAULT_LICENSE_API_MAX_REQUESTS
  const windowMs = options.windowMs ?? DEFAULT_LICENSE_API_WINDOW_MS
  const getNow = options.now ?? Date.now
  const records = new Map<string, number[]>()
  // 清理检查粒度：windowMs 大小无关，但避免每次 check 都全表扫描
  let lastCleanupAt = 0

  function cleanupExpiredKeys(now: number) {
    // 每 windowMs 清理一次过期 key，防止伪造 IP 导致 Map 无限增长
    if (now - lastCleanupAt < windowMs) {
      return
    }

    lastCleanupAt = now
    for (const [key, timestamps] of records) {
      if (normalizeFailures(timestamps, now, windowMs).length === 0) {
        records.delete(key)
      }
    }
  }

  return {
    check(key: string): LicenseApiRateLimitCheckResult {
      const now = getNow()
      cleanupExpiredKeys(now)

      const timestamps = normalizeFailures(records.get(key) ?? [], now, windowMs)
      timestamps.push(now)
      records.set(key, timestamps)

      if (timestamps.length > maxRequests) {
        const oldestInWindow = timestamps[0]
        const retryAfterMs = windowMs - (now - oldestInWindow)
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
        }
      }

      return { allowed: true }
    },
  }
}

export const defaultLicenseApiRateLimiter = createLicenseApiRateLimiter({
  maxRequests: Number(process.env.LICENSE_API_RATE_LIMIT_MAX) || DEFAULT_LICENSE_API_MAX_REQUESTS,
  windowMs: Number(process.env.LICENSE_API_RATE_LIMIT_WINDOW_MS) || DEFAULT_LICENSE_API_WINDOW_MS,
})

export function buildLicenseApiRateLimitKey(request: Request, path: string) {
  const ip =
    (request as Request & { ip?: string }).ip ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'

  return `${path}:${ip}`
}