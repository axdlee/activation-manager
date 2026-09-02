import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const DEFAULT_DATABASE_URL = 'file:./dev.db'

export function resolveDatabaseUrl(databaseUrl: string | undefined = process.env.DATABASE_URL) {
  return databaseUrl?.trim() || DEFAULT_DATABASE_URL
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: resolveDatabaseUrl(),
      },
    },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma