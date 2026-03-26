import assert from 'node:assert/strict'
import test from 'node:test'

import { NextRequest } from 'next/server'

import { middleware } from '../src/middleware'

function createJsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  })
}

test('middleware 在受保护后台页收到 401 时会重定向到登录页', async () => {
  const originalFetch = global.fetch
  const originalPort = process.env.PORT
  let capturedUrl = ''
  global.fetch = async (input) => {
    capturedUrl = String(input)
    return createJsonResponse(
      {
        success: false,
        code: 'token_invalid',
        error: '无效的认证令牌',
        status: 401,
      },
      401,
    )
  }
  process.env.PORT = '3000'

  try {
    const response = await middleware(new NextRequest('https://example.com/admin/dashboard'))

    assert.equal(response.status, 307)
    assert.equal(response.headers.get('location'), 'https://example.com/admin/login')
    assert.equal(
      capturedUrl,
      'http://127.0.0.1:3000/api/admin/auth/validate?mode=protected',
    )
  } finally {
    global.fetch = originalFetch
    if (originalPort === undefined) {
      delete process.env.PORT
    } else {
      process.env.PORT = originalPort
    }
  }
})

test('middleware 在登录页收到 403 时会直接返回错误响应', async () => {
  const originalFetch = global.fetch
  const originalPort = process.env.PORT
  global.fetch = async () =>
    createJsonResponse(
      {
        success: false,
        code: 'ip_not_allowed',
        error: '访问被拒绝: IP地址不在白名单中',
        status: 403,
      },
      403,
    )
  process.env.PORT = '3000'

  try {
    const response = await middleware(new NextRequest('https://example.com/admin/login'))

    assert.equal(response.status, 403)
    assert.equal(response.headers.get('content-type'), 'text/plain; charset=utf-8')
    assert.equal(await response.text(), '访问被拒绝: IP地址不在白名单中')
  } finally {
    global.fetch = originalFetch
    if (originalPort === undefined) {
      delete process.env.PORT
    } else {
      process.env.PORT = originalPort
    }
  }
})
