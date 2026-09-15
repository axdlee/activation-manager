import assert from 'node:assert/strict'
import test from 'node:test'

import { NextRequest } from 'next/server'

import {
  buildShopApiRateLimitKey,
  guardShopApiRateLimit,
} from '../src/lib/shop-api-rate-limit'

function createRequest(ip: string, path: string) {
  const url = `http://127.0.0.1:3000${path}`
  return new NextRequest(url, {
    headers: { 'x-forwarded-for': ip },
  })
}

test('buildShopApiRateLimitKey 按 IP + 路径区分', () => {
  const a = buildShopApiRateLimitKey(createRequest('1.2.3.4', '/api/shop/orders'), '/api/shop/orders')
  const b = buildShopApiRateLimitKey(createRequest('5.6.7.8', '/api/shop/orders'), '/api/shop/orders')
  const c = buildShopApiRateLimitKey(createRequest('1.2.3.4', '/api/shop/orders/query'), '/api/shop/orders/query')

  assert.notEqual(a, b)
  assert.notEqual(a, c)
})

test('guardShopApiRateLimit 在窗口内允许请求', () => {
  const result = guardShopApiRateLimit(createRequest('10.0.0.1', '/api/shop/orders'), '/api/shop/orders')
  assert.equal(result.allowed, true)
})

test('guardShopApiRateLimit 对同一 IP 高频请求返回 429', () => {
  let blocked = false
  for (let i = 0; i < 70; i++) {
    const result = guardShopApiRateLimit(
      createRequest('10.0.0.2', '/api/shop/orders'),
      '/api/shop/orders',
    )
    if (!result.allowed) {
      blocked = true
      assert.equal(result.response.status, 429)
      break
    }
  }
  assert.equal(blocked, true)
})

test('guardShopApiRateLimit 不同 IP 互不影响', () => {
  // 打满一个 IP
  for (let i = 0; i < 70; i++) {
    guardShopApiRateLimit(createRequest('10.0.0.3', '/api/shop/orders'), '/api/shop/orders')
  }

  // 另一个 IP 应仍被允许
  const result = guardShopApiRateLimit(createRequest('10.0.0.4', '/api/shop/orders'), '/api/shop/orders')
  assert.equal(result.allowed, true)
})
