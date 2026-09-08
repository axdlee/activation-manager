import assert from 'node:assert/strict'
import test from 'node:test'

import { NextRequest, NextResponse } from 'next/server'

/**
 * Admin API 统一限流测试：
 * 限流器在模块加载时读取 ADMIN_API_RATE_LIMIT_MAX，
 * 因此在测试启动阶段先设置环境变量，再动态导入被测模块，获得可控的小阈值。
 */

let createProtectedAdminRouteHandler: typeof import('../src/lib/admin-route-handler')['createProtectedAdminRouteHandler']
let guardAdminApiRateLimit: typeof import('../src/lib/admin-api-rate-limit')['guardAdminApiRateLimit']

test.before(async () => {
  process.env.ADMIN_API_RATE_LIMIT_MAX = '3'
  const routeHandlerModule = await import('../src/lib/admin-route-handler')
  const rateLimitModule = await import('../src/lib/admin-api-rate-limit')
  createProtectedAdminRouteHandler = routeHandlerModule.createProtectedAdminRouteHandler
  guardAdminApiRateLimit = rateLimitModule.guardAdminApiRateLimit
})

function createRequest(path = '/api/admin/example', ip = '203.0.113.10') {
  return new NextRequest(`http://127.0.0.1:3000${path}`, {
    headers: { 'x-forwarded-for': ip },
  })
}

const authSuccessDeps = () => ({
  verifyAuth: async () => ({ success: true as const }),
  createAuthResponse: (input: { error: string; status: number }) =>
    NextResponse.json({ success: false, message: input.error }, { status: input.status }),
})

test('guardAdminApiRateLimit 超过阈值返回 429 与 Retry-After', () => {
  const path = '/api/admin/rate-example'
  assert.equal(guardAdminApiRateLimit(createRequest(path), path).allowed, true)
  assert.equal(guardAdminApiRateLimit(createRequest(path), path).allowed, true)
  assert.equal(guardAdminApiRateLimit(createRequest(path), path).allowed, true)

  const blocked = guardAdminApiRateLimit(createRequest(path), path)
  assert.equal(blocked.allowed, false)
  if (!blocked.allowed) {
    assert.equal(blocked.response.status, 429)
    assert.ok(Number(blocked.response.headers.get('Retry-After')) >= 1)
  }
})

test('guardAdminApiRateLimit 按 IP + 路径维度隔离计数', () => {
  const otherPath = '/api/admin/rate-other'
  assert.equal(guardAdminApiRateLimit(createRequest(otherPath), otherPath).allowed, true)
  assert.equal(guardAdminApiRateLimit(createRequest(otherPath), otherPath).allowed, true)
  assert.equal(guardAdminApiRateLimit(createRequest(otherPath), otherPath).allowed, true)

  // 换 IP 后不受同路径其他 IP 计数影响
  assert.equal(
    guardAdminApiRateLimit(createRequest(otherPath, '198.51.100.20'), otherPath).allowed,
    true,
  )
})

test('createProtectedAdminRouteHandler 超限时直接返回 429，不再进入业务逻辑', async () => {
  const path = '/api/admin/rate-handler'
  const handler = createProtectedAdminRouteHandler(
    async () => NextResponse.json({ success: true }),
    { logLabel: '限流测试接口' },
    authSuccessDeps(),
  )

  assert.equal((await handler(createRequest(path))).status, 200)
  assert.equal((await handler(createRequest(path))).status, 200)
  assert.equal((await handler(createRequest(path))).status, 200)

  // 阈值为 3：第 4 次请求触发 429
  const response = await handler(createRequest(path))
  assert.equal(response.status, 429)
  assert.deepEqual(await response.json(), {
    success: false,
    message: '请求过于频繁，请稍后重试',
  })
})

test('createProtectedAdminRouteHandler 鉴权失败时不受 429 响应格式影响', async () => {
  const path = '/api/admin/rate-auth'
  const handler = createProtectedAdminRouteHandler(
    async () => NextResponse.json({ success: true }),
    { logLabel: '限流测试接口' },
    {
      verifyAuth: async () => ({
        success: false as const,
        code: 'token_missing',
        error: '未提供认证令牌',
        status: 401,
      }),
      createAuthResponse: (input) =>
        NextResponse.json({ success: false, message: input.error }, { status: input.status }),
    },
  )

  assert.equal((await handler(createRequest(path))).status, 401)
  assert.equal((await handler(createRequest(path))).status, 401)
  assert.equal((await handler(createRequest(path))).status, 401)
  // 限流在鉴权之前执行：第 4 次请求被 429 拦截，而不是继续进入鉴权
  assert.equal((await handler(createRequest(path))).status, 429)
})
