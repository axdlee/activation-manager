import assert from 'node:assert/strict'
import test from 'node:test'

import { NextRequest } from 'next/server'

import { resolveCookieSecure } from '../src/lib/cookie-secure'

function createRequest(protocol: string, forwardedProto?: string | null) {
  const url = `${protocol}//127.0.0.1:3000/api/admin/login`
  const headers: Record<string, string> = {}
  if (forwardedProto) {
    headers['x-forwarded-proto'] = forwardedProto
  }
  return new NextRequest(url, { headers })
}

test('resolveCookieSecure 对明文 HTTP 请求返回 false（允许无 TLS 部署登录）', () => {
  assert.equal(resolveCookieSecure(createRequest('http:')), false)
})

test('resolveCookieSecure 对 HTTPS 请求返回 true', () => {
  assert.equal(resolveCookieSecure(createRequest('https:')), true)
})

test('resolveCookieSecure 识别 x-forwarded-proto=https 反代', () => {
  const request = createRequest('http:', 'https')
  assert.equal(resolveCookieSecure(request), true)
})

test('resolveCookieSecure 识别 x-forwarded-proto 多值取第一个', () => {
  const request = createRequest('http:', 'https, http')
  assert.equal(resolveCookieSecure(request), true)
})

test('resolveCookieSecure 对请求本身是 https 时返回 true（即便代理标记 http）', () => {
  const request = createRequest('https:', 'http')
  assert.equal(resolveCookieSecure(request), true)
})
