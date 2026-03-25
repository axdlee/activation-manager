import assert from 'node:assert/strict'
import test from 'node:test'

import bcrypt from 'bcryptjs'
import { NextRequest } from 'next/server'

import * as dbModule from '../src/lib/db'
import { createAdminLoginRateLimiter } from '../src/lib/admin-login-rate-limit'
import { adminLoginRouteDependencies } from '../src/lib/admin-login-route-handler'
import * as loginRouteModule from '../src/app/api/admin/login/route'

const { prisma } = dbModule
const { POST } = loginRouteModule

function createLoginRequest(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new NextRequest('http://127.0.0.1:3000/api/admin/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

function createAsyncRateLimiter() {
  const rateLimiter = createAdminLoginRateLimiter()

  return {
    check: async (key: string) => rateLimiter.check(key),
    recordFailure: async (key: string) => {
      rateLimiter.recordFailure(key)
    },
    reset: async (key: string) => {
      rateLimiter.reset(key)
    },
    clear: async () => {
      rateLimiter.clear()
    },
  }
}

test('管理员登录成功时，cookie maxAge 与 jwtExpiresIn 配置保持一致', async (t) => {
  const originalFindAdmin = prisma.admin.findUnique.bind(prisma.admin)
  const originalFindSystemConfig = prisma.systemConfig.findUnique.bind(prisma.systemConfig)
  const originalCompare = bcrypt.compare
  const originalRateLimiter = adminLoginRouteDependencies.rateLimiter

  adminLoginRouteDependencies.rateLimiter = createAsyncRateLimiter()

  ;(prisma.admin as typeof prisma.admin & { findUnique: typeof prisma.admin.findUnique }).findUnique = async () => ({
    id: 1,
    username: 'admin',
    password: 'hashed-password',
    createdAt: new Date('2026-03-24T00:00:00.000Z'),
    updatedAt: new Date('2026-03-24T00:00:00.000Z'),
  })

  ;(
    prisma.systemConfig as typeof prisma.systemConfig & {
      findUnique: typeof prisma.systemConfig.findUnique
    }
  ).findUnique = async ({ where }: { where: { key: string } }) => {
    if (where.key === 'jwtSecret') {
      return {
        id: 1,
        key: 'jwtSecret',
        value: 'unit-test-secret',
        description: 'JWT密钥',
        createdAt: new Date('2026-03-24T00:00:00.000Z'),
        updatedAt: new Date('2026-03-24T00:00:00.000Z'),
      }
    }

    if (where.key === 'jwtExpiresIn') {
      return {
        id: 2,
        key: 'jwtExpiresIn',
        value: '7d',
        description: 'JWT过期时间',
        createdAt: new Date('2026-03-24T00:00:00.000Z'),
        updatedAt: new Date('2026-03-24T00:00:00.000Z'),
      }
    }

    return null
  }

  bcrypt.compare = async () => true

  t.after(async () => {
    ;(prisma.admin as typeof prisma.admin & { findUnique: typeof prisma.admin.findUnique }).findUnique = originalFindAdmin
    ;(
      prisma.systemConfig as typeof prisma.systemConfig & {
        findUnique: typeof prisma.systemConfig.findUnique
      }
    ).findUnique = originalFindSystemConfig
    bcrypt.compare = originalCompare
    adminLoginRouteDependencies.rateLimiter = originalRateLimiter
    await prisma.$disconnect()
  })

  const response = await POST(
    createLoginRequest(
      { username: 'admin', password: '123456' },
      { 'x-forwarded-for': '198.51.100.10' },
    ),
  )
  const body = await response.json()
  const setCookieHeader = response.headers.get('set-cookie') || ''

  assert.equal(response.status, 200)
  assert.equal(body.success, true)
  assert.match(setCookieHeader, /auth-token=/)
  assert.match(setCookieHeader, /Max-Age=604800/)
})

test('管理员登录连续输错密码超过阈值后会被限流并返回 Retry-After', async (t) => {
  const originalFindAdmin = prisma.admin.findUnique.bind(prisma.admin)
  const originalCompare = bcrypt.compare
  const originalRateLimiter = adminLoginRouteDependencies.rateLimiter
  let findAdminCallCount = 0
  let compareCallCount = 0

  adminLoginRouteDependencies.rateLimiter = createAsyncRateLimiter()

  ;(prisma.admin as typeof prisma.admin & { findUnique: typeof prisma.admin.findUnique }).findUnique = async () => {
    findAdminCallCount += 1

    return {
      id: 1,
      username: 'admin',
      password: 'hashed-password',
      createdAt: new Date('2026-03-24T00:00:00.000Z'),
      updatedAt: new Date('2026-03-24T00:00:00.000Z'),
    }
  }

  bcrypt.compare = async () => {
    compareCallCount += 1
    return false
  }

  t.after(async () => {
    ;(prisma.admin as typeof prisma.admin & { findUnique: typeof prisma.admin.findUnique }).findUnique = originalFindAdmin
    bcrypt.compare = originalCompare
    adminLoginRouteDependencies.rateLimiter = originalRateLimiter
    await prisma.$disconnect()
  })

  for (let index = 0; index < 5; index += 1) {
    const response = await POST(
      createLoginRequest(
        { username: 'admin', password: 'wrong-password' },
        { 'x-forwarded-for': '203.0.113.10' },
      ),
    )

    assert.equal(response.status, 401)
  }

  const blockedResponse = await POST(
    createLoginRequest(
      { username: 'admin', password: 'wrong-password' },
      { 'x-forwarded-for': '203.0.113.10' },
    ),
  )
  const blockedBody = await blockedResponse.json()
  const retryAfter = blockedResponse.headers.get('retry-after') || ''

  assert.equal(blockedResponse.status, 429)
  assert.equal(blockedBody.success, false)
  assert.match(blockedBody.message, /登录失败次数过多/)
  assert.match(retryAfter, /^[1-9]\d*$/)
  assert.equal(findAdminCallCount, 5)
  assert.equal(compareCallCount, 5)
})
