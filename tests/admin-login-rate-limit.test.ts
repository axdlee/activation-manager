import assert from 'node:assert/strict'
import test from 'node:test'

import { createAdminLoginRateLimiter } from '../src/lib/admin-login-rate-limit'

test('createAdminLoginRateLimiter 在连续失败达到阈值后会锁定并返回重试秒数', () => {
  let now = 0
  const limiter = createAdminLoginRateLimiter({
    maxAttempts: 3,
    windowMs: 60 * 1000,
    lockoutMs: 5 * 60 * 1000,
    now: () => now,
  })

  limiter.recordFailure('127.0.0.1')
  limiter.recordFailure('127.0.0.1')
  limiter.recordFailure('127.0.0.1')

  const result = limiter.check('127.0.0.1')

  assert.deepEqual(result, {
    allowed: false,
    retryAfterSeconds: 300,
  })
})

test('createAdminLoginRateLimiter 的 reset 会清空已累积的失败计数', () => {
  let now = 0
  const limiter = createAdminLoginRateLimiter({
    maxAttempts: 2,
    windowMs: 60 * 1000,
    lockoutMs: 5 * 60 * 1000,
    now: () => now,
  })

  limiter.recordFailure('127.0.0.1')
  limiter.recordFailure('127.0.0.1')
  limiter.reset('127.0.0.1')

  assert.deepEqual(limiter.check('127.0.0.1'), { allowed: true })
})

test('createAdminLoginRateLimiter 会在失败窗口过后自动放行', () => {
  let now = 0
  const limiter = createAdminLoginRateLimiter({
    maxAttempts: 3,
    windowMs: 60 * 1000,
    lockoutMs: 5 * 60 * 1000,
    now: () => now,
  })

  limiter.recordFailure('127.0.0.1')
  now = 10 * 1000
  limiter.recordFailure('127.0.0.1')
  now = 70 * 1000
  limiter.recordFailure('127.0.0.1')

  assert.deepEqual(limiter.check('127.0.0.1'), { allowed: true })
})
