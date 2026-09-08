// 针对公开 License API 的轻量级限流器。
// 默认基于进程内滑动窗口（IP + 路径维度），单实例部署友好。
// 多实例部署时可注入共享存储实现（如 Redis），只需实现 RateLimitStore 接口：
//
//   const redisStore: RateLimitStore = {
//     async get(key) { ... },
//     async set(key, timestamps, ttlMs) { ... },
//   }
//   const limiter = createLicenseApiRateLimiter({ store: redisStore })
//
// 并在反向代理层保留兜底限流。

export type LicenseApiRateLimitCheckResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number }

export type LicenseApiRateLimiter = {
  check(key: string): LicenseApiRateLimitCheckResult
}

/**
 * 限流存储接口缝：把「时间戳窗口的读写」与「滑动窗口判定逻辑」解耦。
 * - get(key)：返回该 key 窗口内的原始时间戳（毫秒）；无记录返回 undefined/null
 * - set(key, timestamps)：写回时间戳数组；ttlMs 为建议过期时间（共享存储可据此自动淘汰）
 * 默认实现为进程内 Map（InMemoryRateLimitStore）。
 *
 * 说明：接口为同步契约（路由守卫 check() 为同步调用）。
 * 接入 Redis 等异步共享存储时，建议实现「本地读缓存 + 异步回写」的薄适配层，
 * 或在该接缝上扩展 checkAsync 变体后再切换路由守卫。
 */
export type RateLimitStore = {
  get(key: string): number[] | null | undefined
  set(key: string, timestamps: number[], ttlMs: number): void
}

export type LicenseApiRateLimiterOptions = {
  maxRequests?: number
  windowMs?: number
  now?: () => number
  /** 自定义共享存储；缺省使用进程内 Map */
  store?: RateLimitStore
}

export const DEFAULT_LICENSE_API_MAX_REQUESTS = 120
export const DEFAULT_LICENSE_API_WINDOW_MS = 60 * 1000

/** 默认进程内存储：Map<key, timestamps[]>，由限流器负责过期清理 */
export class InMemoryRateLimitStore implements RateLimitStore {
  private records = new Map<string, number[]>()

  get(key: string): number[] | undefined {
    return this.records.get(key)
  }

  set(key: string, timestamps: number[], _ttlMs: number): void {
    this.records.set(key, timestamps)
  }

  /** 删除窗口内已无时间戳的 key（防止伪造 IP 导致 Map 无限增长） */
  cleanupExpired(normalize: (timestamps: number[]) => number[]): void {
    for (const [key, timestamps] of this.records) {
      if (normalize(timestamps).length === 0) {
        this.records.delete(key)
      }
    }
  }

  size(): number {
    return this.records.size
  }
}

export function createLicenseApiRateLimiter(
  options: LicenseApiRateLimiterOptions = {},
): LicenseApiRateLimiter {
  const maxRequests = options.maxRequests ?? DEFAULT_LICENSE_API_MAX_REQUESTS
  const windowMs = options.windowMs ?? DEFAULT_LICENSE_API_WINDOW_MS
  const getNow = options.now ?? Date.now
  const store = options.store ?? new InMemoryRateLimitStore()
  const inMemoryStore = store instanceof InMemoryRateLimitStore ? store : null
  // 清理检查粒度：windowMs 大小无关，但避免每次 check 都全表扫描
  let lastCleanupAt = 0

  function normalizeTimestamps(timestamps: number[], now: number) {
    return timestamps.filter((t) => now - t < windowMs)
  }

  function cleanupExpiredKeys(now: number) {
    if (now - lastCleanupAt < windowMs) {
      return
    }

    lastCleanupAt = now
    if (inMemoryStore) {
      inMemoryStore.cleanupExpired((timestamps) => normalizeTimestamps(timestamps, now))
    }
  }

  return {
    check(key: string): LicenseApiRateLimitCheckResult {
      const now = getNow()
      cleanupExpiredKeys(now)

      const timestamps = normalizeTimestamps(store.get(key) ?? [], now)
      timestamps.push(now)
      store.set(key, timestamps, windowMs)

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
