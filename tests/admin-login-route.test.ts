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

  prisma.admin.findUnique = (async () => ({
    id: 1,
    username: 'admin',
    password: 'hashed-password',
    createdAt: new Date('2026-03-24T00:00:00.000Z'),
    updatedAt: new Date('2026-03-24T00:00:00.000Z'),
  })) as unknown as typeof prisma.admin.findUnique

  prisma.systemConfig.findUnique = (async ({ where }: { where: { key: string } }) => {
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
  }) as unknown as typeof prisma.systemConfig.findUnique

  bcrypt.compare = async () => true

  t.after(async () => {
    prisma.admin.findUnique = originalFindAdmin
    prisma.systemConfig.findUnique = originalFindSystemConfig
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

  prisma.admin.findUnique = (async () => {
    findAdminCallCount += 1

    return {
      id: 1,
      username: 'admin',
      password: 'hashed-password',
      createdAt: new Date('2026-03-24T00:00:00.000Z'),
      updatedAt: new Date('2026-03-24T00:00:00.000Z'),
    }
  }) as unknown as typeof prisma.admin.findUnique

  bcrypt.compare = async () => {
    compareCallCount += 1
    return false
  }

  t.after(async () => {
    prisma.admin.findUnique = originalFindAdmin
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

test('同一账号跨 IP 轮换爆破时按用户名维度锁定', async (t) => {
  const originalFindAdmin = prisma.admin.findUnique.bind(prisma.admin)
  const originalCompare = bcrypt.compare
  const originalRateLimiter = adminLoginRouteDependencies.rateLimiter
  let findAdminCallCount = 0

  adminLoginRouteDependencies.rateLimiter = createAsyncRateLimiter()

  prisma.admin.findUnique = (async () => {
    findAdminCallCount += 1

    return {
      id: 1,
      username: 'admin',
      password: 'hashed-password',
      createdAt: new Date('2026-03-24T00:00:00.000Z'),
      updatedAt: new Date('2026-03-24T00:00:00.000Z'),
    }
  }) as unknown as typeof prisma.admin.findUnique

  bcrypt.compare = async () => false

  t.after(async () => {
    prisma.admin.findUnique = originalFindAdmin
    bcrypt.compare = originalCompare
    adminLoginRouteDependencies.rateLimiter = originalRateLimiter
    await prisma.$disconnect()
  })

  // 每次请求都换一个 X-Forwarded-For：IP 维度永远达不到阈值，
  // 只能靠用户名维度把同一账号的爆破拦下来
  for (let index = 0; index < 5; index += 1) {
    const response = await POST(
      createLoginRequest(
        { username: 'admin', password: 'wrong-password' },
        { 'x-forwarded-for': `203.0.113.${index + 1}` },
      ),
    )

    assert.equal(response.status, 401)
  }

  const blockedResponse = await POST(
    createLoginRequest(
      { username: 'admin', password: 'wrong-password' },
      { 'x-forwarded-for': '198.51.100.99' },
    ),
  )
  const blockedBody = await blockedResponse.json()
  const retryAfter = blockedResponse.headers.get('retry-after') || ''

  assert.equal(blockedResponse.status, 429)
  assert.equal(blockedBody.success, false)
  assert.match(blockedBody.message, /登录失败次数过多/)
  assert.match(retryAfter, /^[1-9]\d*$/)
  // 用户名维度锁定后仍需校验密码（正确凭据必须能登录，见下一条回归），
  // 因此第 6 次请求会走到查库与密码比对
  assert.equal(findAdminCallCount, 6)
})

test('用户名维度锁定后，正确密码仍可登录并重置计数（防远程锁死管理员）', async (t) => {
  const originalFindAdmin = prisma.admin.findUnique.bind(prisma.admin)
  const originalCompare = bcrypt.compare
  const originalRateLimiter = adminLoginRouteDependencies.rateLimiter

  adminLoginRouteDependencies.rateLimiter = createAsyncRateLimiter()

  prisma.admin.findUnique = (async () => ({
    id: 1,
    username: 'admin',
    password: 'hashed-password',
    createdAt: new Date('2026-03-24T00:00:00.000Z'),
    updatedAt: new Date('2026-03-24T00:00:00.000Z'),
  })) as unknown as typeof prisma.admin.findUnique

  let passwordIsCorrect = false
  bcrypt.compare = async () => passwordIsCorrect

  t.after(async () => {
    prisma.admin.findUnique = originalFindAdmin
    bcrypt.compare = originalCompare
    adminLoginRouteDependencies.rateLimiter = originalRateLimiter
    await prisma.$disconnect()
  })

  // 攻击者换 IP 错输 5 次，把用户名维度打到锁定
  for (let index = 0; index < 5; index += 1) {
    const response = await POST(
      createLoginRequest(
        { username: 'admin', password: 'wrong-password' },
        { 'x-forwarded-for': `203.0.113.${index + 1}` },
      ),
    )
    assert.equal(response.status, 401)
  }

  // 锁定期间继续错试：返回 429，而不是 401
  const blockedResponse = await POST(
    createLoginRequest(
      { username: 'admin', password: 'wrong-password' },
      { 'x-forwarded-for': '198.51.100.99' },
    ),
  )
  assert.equal(blockedResponse.status, 429)

  // 真实管理员输对密码：必须放行（旧实现直接 429，后台被远程锁死）
  passwordIsCorrect = true
  const successResponse = await POST(
    createLoginRequest(
      { username: 'admin', password: '123456' },
      { 'x-forwarded-for': '198.51.100.99' },
    ),
  )
  const successBody = await successResponse.json()
  assert.equal(successResponse.status, 200)
  assert.equal(successBody.success, true)

  // 成功登录重置两把 key：此后同一 IP/用户名可正常再次登录
  const followupResponse = await POST(
    createLoginRequest(
      { username: 'admin', password: '123456' },
      { 'x-forwarded-for': '198.51.100.99' },
    ),
  )
  assert.equal(followupResponse.status, 200)
})
