type AdminLoginRateLimiterOptions = {
  maxAttempts?: number
  windowMs?: number
  lockoutMs?: number
  now?: () => number
}

type AdminLoginAttemptRecord = {
  failures: number[]
  lockedUntil: number | null
}

export type AdminLoginRateLimitCheckResult =
  | {
      allowed: true
    }
  | {
      allowed: false
      retryAfterSeconds: number
    }

export const DEFAULT_ADMIN_LOGIN_MAX_ATTEMPTS = 5
export const DEFAULT_ADMIN_LOGIN_WINDOW_MS = 15 * 60 * 1000
export const DEFAULT_ADMIN_LOGIN_LOCKOUT_MS = 15 * 60 * 1000

function normalizeFailures(failures: number[], now: number, windowMs: number) {
  return failures.filter((timestamp) => now - timestamp < windowMs)
}

export function createAdminLoginRateLimiter(options: AdminLoginRateLimiterOptions = {}) {
  const maxAttempts = options.maxAttempts ?? DEFAULT_ADMIN_LOGIN_MAX_ATTEMPTS
  const windowMs = options.windowMs ?? DEFAULT_ADMIN_LOGIN_WINDOW_MS
  const lockoutMs = options.lockoutMs ?? DEFAULT_ADMIN_LOGIN_LOCKOUT_MS
  const getNow = options.now ?? Date.now
  const records = new Map<string, AdminLoginAttemptRecord>()

  function getRecord(key: string, now: number) {
    const currentRecord = records.get(key)
    if (!currentRecord) {
      return null
    }

    if (currentRecord.lockedUntil !== null && currentRecord.lockedUntil <= now) {
      records.delete(key)
      return null
    }

    const normalizedRecord = {
      failures: normalizeFailures(currentRecord.failures, now, windowMs),
      lockedUntil: currentRecord.lockedUntil,
    }

    if (normalizedRecord.failures.length === 0 && normalizedRecord.lockedUntil === null) {
      records.delete(key)
      return null
    }

    records.set(key, normalizedRecord)
    return normalizedRecord
  }

  return {
    check(key: string): AdminLoginRateLimitCheckResult {
      const now = getNow()
      const record = getRecord(key, now)

      if (!record || record.lockedUntil === null) {
        return { allowed: true }
      }

      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((record.lockedUntil - now) / 1000)),
      }
    },
    recordFailure(key: string) {
      const now = getNow()
      const record = getRecord(key, now)
      const failures = [...(record?.failures ?? []), now]
      const shouldLock = failures.length >= maxAttempts

      records.set(key, {
        failures,
        lockedUntil: shouldLock ? now + lockoutMs : null,
      })
    },
    reset(key: string) {
      records.delete(key)
    },
    clear() {
      records.clear()
    },
  }
}

export const adminLoginRateLimiter = createAdminLoginRateLimiter()
