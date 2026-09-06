import assert from 'node:assert/strict'
import test from 'node:test'

import { NextRequest } from 'next/server'

import * as dbModule from '../src/lib/db'
import { bootstrapDevelopmentDatabase } from '../src/lib/dev-bootstrap'
import { handleAdminLoginRequest } from '../src/lib/admin-login-route-handler'
import type { AsyncAdminLoginRateLimiter } from '../src/lib/admin-login-rate-limit'

const { prisma } = dbModule

const silentLogger = { log: () => undefined, error: () => undefined }

// 限流器由登录 handler 内部依赖，测试无需注入；保留类型导入以对齐签名
void (null as unknown as AsyncAdminLoginRateLimiter)

test.before(async () => {
  await bootstrapDevelopmentDatabase({ logger: silentLogger })
})

test.after(async () => {
  await prisma.$disconnect()
})

test('明文 HTTP 部署下登录成功且 auth-token cookie 不带 Secure 属性', async () => {
  const request = new NextRequest('http://127.0.0.1:3000/api/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: '123456' }),
  })

  const response = await handleAdminLoginRequest(request)
  assert.equal(response.status, 200)

  const setCookie = response.headers.get('set-cookie') ?? ''
  assert.match(setCookie, /auth-token=/)
  assert.match(setCookie, /HttpOnly/)
  // 明文 HTTP 下不应有 Secure（否则浏览器拒绝保存导致登录死循环）
  assert.equal(setCookie.includes('Secure'), false)
})

test('HTTPS 请求下 auth-token cookie 带 Secure 属性', async () => {
  const request = new NextRequest('https://127.0.0.1:3000/api/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: '123456' }),
  })

  const response = await handleAdminLoginRequest(request)
  assert.equal(response.status, 200)

  const setCookie = response.headers.get('set-cookie') ?? ''
  assert.match(setCookie, /auth-token=/)
  assert.match(setCookie, /Secure/)
})
