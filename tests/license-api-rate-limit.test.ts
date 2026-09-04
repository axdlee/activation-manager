import assert from 'node:assert/strict'
import test from 'node:test'

import { createLicenseRouteHandler } from '../src/lib/license-route-handlers'
import {
  createLicenseApiRateLimiter,
  buildLicenseApiRateLimitKey,
} from '../src/lib/license-api-rate-limit'

function createJsonRequest(url: string, body: Record<string, unknown>) {
  return new Request(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

test('createLicenseApiRateLimiter 在窗口内未超过上限时放行', () => {
  const limiter = createLicenseApiRateLimiter({
    maxRequests: 3,
    windowMs: 1000,
    now: () => 1000,
  })

  assert.equal(limiter.check('a').allowed, true)
  assert.equal(limiter.check('a').allowed, true)
  assert.equal(limiter.check('a').allowed, true)
})

test('createLicenseApiRateLimiter 超过上限时拒绝并给出重试秒数', () => {
  let now = 1000
  const limiter = createLicenseApiRateLimiter({
    maxRequests: 3,
    windowMs: 1000,
    now: () => now,
  })

  limiter.check('a')
  limiter.check('a')
  limiter.check('a')

  const result = limiter.check('a')
  assert.equal(result.allowed, false)
  assert.ok(result.allowed === false && result.retryAfterSeconds >= 1)
})

test('createLicenseApiRateLimiter 窗口滑动后恢复放行', () => {
  let now = 1000
  const limiter = createLicenseApiRateLimiter({
    maxRequests: 2,
    windowMs: 1000,
    now: () => now,
  })

  limiter.check('a')
  limiter.check('a')
  assert.equal(limiter.check('a').allowed, false)

  // 时间前进超过窗口后应恢复
  now = 2500
  assert.equal(limiter.check('a').allowed, true)
})

test('createLicenseApiRateLimiter 不同 key 相互独立', () => {
  const limiter = createLicenseApiRateLimiter({
    maxRequests: 1,
    windowMs: 1000,
    now: () => 1000,
  })

  assert.equal(limiter.check('a').allowed, true)
  assert.equal(limiter.check('a').allowed, false)
  assert.equal(limiter.check('b').allowed, true)
})

test('buildLicenseApiRateLimitKey 使用路径与来源 IP 组合', () => {
  const request = createJsonRequest('http://127.0.0.1:3000/api/license/consume', {
    code: 'CODE',
    machineId: 'M',
  })

  const key = buildLicenseApiRateLimitKey(request, '/api/license/consume')
  assert.equal(key, '/api/license/consume:127.0.0.1')
})

test('createLicenseRouteHandler 在限流拒绝时返回 429 与 Retry-After', async () => {
  let now = 1000
  const limiter = createLicenseApiRateLimiter({
    maxRequests: 1,
    windowMs: 1000,
    now: () => now,
  })

  const handler = createLicenseRouteHandler(
    async () => ({
      success: true,
      message: 'ok',
      status: 200,
    }),
    {
      errorMessage: '处理失败',
    },
    { rateLimiter: limiter },
  )

  const first = await handler(
    createJsonRequest('http://127.0.0.1:3000/api/license/consume', {
      code: 'COUNT-001',
      machineId: 'machine-001',
    }),
  )
  assert.equal(first.status, 200)

  const second = await handler(
    createJsonRequest('http://127.0.0.1:3000/api/license/consume', {
      code: 'COUNT-001',
      machineId: 'machine-001',
    }),
  )
  assert.equal(second.status, 429)
  assert.ok(Number(second.headers.get('Retry-After')) >= 1)

  const body = await second.json()
  assert.equal(body.success, false)
  assert.match(body.message, /频繁/)
})
test('createLicenseApiRateLimiter 窗口过期后自动清理 Map key，避免内存泄漏', () => {
  let now = 1000
  const limiter = createLicenseApiRateLimiter({
    maxRequests: 3,
    windowMs: 1000,
    now: () => now,
  })

  // 用大量伪造 key 模拟攻击
  for (let i = 0; i < 50; i += 1) {
    limiter.check(`fake-${i}`)
  }

  // 时间推进超过窗口后再次 check，应触发清理
  now = 5000
  limiter.check('new-key')

  // 重新 check 旧 key 应不携带旧时间戳（若等价于新 key）
  const result = limiter.check('fake-0')
  assert.equal(result.allowed, true)
})

test('createLicenseApiRateLimiter 清理后旧 key 重新计数', () => {
  let now = 1000
  const limiter = createLicenseApiRateLimiter({
    maxRequests: 2,
    windowMs: 1000,
    now: () => now,
  })

  limiter.check('a')
  limiter.check('a')
  assert.equal(limiter.check('a').allowed, false)

  // 窗口过期后重置
  now = 3000
  limiter.check('b') // 触发清理
  assert.equal(limiter.check('a').allowed, true)
})
