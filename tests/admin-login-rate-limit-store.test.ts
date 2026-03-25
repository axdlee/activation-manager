import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { PrismaClient } from '@prisma/client'

import {
  createSharedAdminLoginRateLimiter,
} from '../src/lib/admin-login-rate-limit'
import { createPrismaAdminLoginRateLimitStore } from '../src/lib/admin-login-rate-limit-store'
import { bootstrapDevelopmentDatabase } from '../src/lib/dev-bootstrap'

const silentLogger = {
  log: () => undefined,
  error: () => undefined,
}

test('createSharedAdminLoginRateLimiter 会通过 Prisma store 在不同实例间共享限流状态', async (t) => {
  let now = 0
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'activation-manager-login-rate-limit-'))
  const dbPath = path.join(tempDir, 'dev.db')

  await bootstrapDevelopmentDatabase({
    dbPath,
    logger: silentLogger,
  })

  const datasourceUrl = `file:${dbPath}`
  const prismaA = new PrismaClient({
    datasources: {
      db: {
        url: datasourceUrl,
      },
    },
  })
  const prismaB = new PrismaClient({
    datasources: {
      db: {
        url: datasourceUrl,
      },
    },
  })

  t.after(async () => {
    await prismaA.$disconnect()
    await prismaB.$disconnect()
  })

  const limiterA = createSharedAdminLoginRateLimiter(
    createPrismaAdminLoginRateLimitStore(prismaA),
    {
      maxAttempts: 3,
      windowMs: 60 * 1000,
      lockoutMs: 5 * 60 * 1000,
      now: () => now,
    },
  )
  const limiterB = createSharedAdminLoginRateLimiter(
    createPrismaAdminLoginRateLimitStore(prismaB),
    {
      maxAttempts: 3,
      windowMs: 60 * 1000,
      lockoutMs: 5 * 60 * 1000,
      now: () => now,
    },
  )

  await limiterA.recordFailure('203.0.113.10')
  await limiterA.recordFailure('203.0.113.10')
  await limiterA.recordFailure('203.0.113.10')

  assert.deepEqual(await limiterB.check('203.0.113.10'), {
    allowed: false,
    retryAfterSeconds: 300,
  })

  await limiterB.reset('203.0.113.10')

  assert.deepEqual(await limiterA.check('203.0.113.10'), {
    allowed: true,
  })
  assert.equal(await prismaA.adminLoginRateLimitState.count(), 0)
})
