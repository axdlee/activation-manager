import { prisma } from './db'
import {
  createPrismaAdminLoginRateLimitStore,
  type AdminLoginAttemptRecord,
  type AdminLoginRateLimitStore,
} from './admin-login-rate-limit-store'

type AdminLoginRateLimiterOptions = {
  maxAttempts?: number
  windowMs?: number
  lockoutMs?: number
  now?: () => number
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

function normalizeAttemptRecord(
  record: AdminLoginAttemptRecord | null,
  now: number,
  windowMs: number,
) {
  if (!record) {
    return null
  }

  if (record.lockedUntil !== null && record.lockedUntil <= now) {
    return null
  }

  const normalizedRecord = {
    failures: normalizeFailures(record.failures, now, windowMs),
    lockedUntil: record.lockedUntil,
  }

  return normalizedRecord.failures.length === 0 && normalizedRecord.lockedUntil === null
    ? null
    : normalizedRecord
}

export function createAdminLoginRateLimiter(options: AdminLoginRateLimiterOptions = {}) {
  const maxAttempts = options.maxAttempts ?? DEFAULT_ADMIN_LOGIN_MAX_ATTEMPTS
  const windowMs = options.windowMs ?? DEFAULT_ADMIN_LOGIN_WINDOW_MS
  const lockoutMs = options.lockoutMs ?? DEFAULT_ADMIN_LOGIN_LOCKOUT_MS
  const getNow = options.now ?? Date.now
  const records = new Map<string, AdminLoginAttemptRecord>()

  function getRecord(key: string, now: number) {
    const normalizedRecord = normalizeAttemptRecord(records.get(key) ?? null, now, windowMs)
    if (!normalizedRecord) {
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

export type AsyncAdminLoginRateLimiter = {
  check(key: string): Promise<AdminLoginRateLimitCheckResult>
  recordFailure(key: string): Promise<void>
  reset(key: string): Promise<void>
  clear(): Promise<void>
}

function buildFailureRecord(
  record: AdminLoginAttemptRecord | null,
  now: number,
  maxAttempts: number,
  lockoutMs: number,
) {
  const failures = [...(record?.failures ?? []), now]
  const shouldLock = failures.length >= maxAttempts

  return {
    failures,
    lockedUntil: shouldLock ? now + lockoutMs : null,
  } satisfies AdminLoginAttemptRecord
}

export function createSharedAdminLoginRateLimiter(
  store: AdminLoginRateLimitStore,
  options: AdminLoginRateLimiterOptions = {},
): AsyncAdminLoginRateLimiter {
  const maxAttempts = options.maxAttempts ?? DEFAULT_ADMIN_LOGIN_MAX_ATTEMPTS
  const windowMs = options.windowMs ?? DEFAULT_ADMIN_LOGIN_WINDOW_MS
  const lockoutMs = options.lockoutMs ?? DEFAULT_ADMIN_LOGIN_LOCKOUT_MS
  const getNow = options.now ?? Date.now

  async function getRecord(key: string, now: number) {
    const currentRecord = await store.read(key)
    const normalizedRecord = normalizeAttemptRecord(currentRecord, now, windowMs)

    if (!normalizedRecord) {
      if (currentRecord) {
        await store.delete(key)
      }
      return null
    }

    if (
      !currentRecord ||
      currentRecord.lockedUntil !== normalizedRecord.lockedUntil ||
      currentRecord.failures.length !== normalizedRecord.failures.length ||
      currentRecord.failures.some((failure, index) => failure !== normalizedRecord.failures[index])
    ) {
      await store.write(key, normalizedRecord)
    }

    return normalizedRecord
  }

  return {
    async check(key) {
      const now = getNow()
      const record = await getRecord(key, now)

      if (!record || record.lockedUntil === null) {
        return { allowed: true }
      }

      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((record.lockedUntil - now) / 1000)),
      }
    },
    async recordFailure(key) {
      const now = getNow()
      const record = await getRecord(key, now)
      await store.write(key, buildFailureRecord(record, now, maxAttempts, lockoutMs))
    },
    async reset(key) {
      await store.delete(key)
    },
    async clear() {
      await store.clear()
    },
  }
}

export const adminLoginRateLimiter = createSharedAdminLoginRateLimiter(
  createPrismaAdminLoginRateLimitStore(prisma),
)
