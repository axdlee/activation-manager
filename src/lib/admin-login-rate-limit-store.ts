import type { PrismaClient } from '@prisma/client'

type AdminLoginRateLimitStateClient = Pick<PrismaClient, 'adminLoginRateLimitState'>

export type AdminLoginAttemptRecord = {
  failures: number[]
  lockedUntil: number | null
}

export type AdminLoginRateLimitStore = {
  read(key: string): Promise<AdminLoginAttemptRecord | null>
  write(key: string, record: AdminLoginAttemptRecord): Promise<void>
  delete(key: string): Promise<void>
  clear(): Promise<void>
}

function parseFailuresJson(failuresJson: string) {
  try {
    const parsedValue = JSON.parse(failuresJson)
    return Array.isArray(parsedValue)
      ? parsedValue
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
      : []
  } catch {
    return []
  }
}

export function createPrismaAdminLoginRateLimitStore(
  client: AdminLoginRateLimitStateClient,
): AdminLoginRateLimitStore {
  return {
    async read(key) {
      const record = await client.adminLoginRateLimitState.findUnique({
        where: { key },
      })

      if (!record) {
        return null
      }

      return {
        failures: parseFailuresJson(record.failuresJson),
        lockedUntil: record.lockedUntil?.getTime() ?? null,
      }
    },
    async write(key, record) {
      await client.adminLoginRateLimitState.upsert({
        where: { key },
        update: {
          failuresJson: JSON.stringify(record.failures),
          lockedUntil: record.lockedUntil === null ? null : new Date(record.lockedUntil),
        },
        create: {
          key,
          failuresJson: JSON.stringify(record.failures),
          lockedUntil: record.lockedUntil === null ? null : new Date(record.lockedUntil),
        },
      })
    },
    async delete(key) {
      await client.adminLoginRateLimitState.deleteMany({
        where: { key },
      })
    },
    async clear() {
      await client.adminLoginRateLimitState.deleteMany()
    },
  }
}
