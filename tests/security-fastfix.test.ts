/**
 * 安全快速修复批次的回归测试：
 * 1) 登出 Cookie 的 secure 判定与登录一致（resolveCookieSecure）——
 *    明文 HTTP 部署下登出必须能真正清掉 cookie
 * 2) placeholder 渠道（微信/支付宝）的伪造回调一律拒绝
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { NextRequest } from 'next/server'

const { prisma } = dbModule

import { POST as logoutPOST } from '../src/app/api/admin/logout/route'
import { POST as wechatPOST } from '../src/app/api/shop/payment/wechat/route'
import { POST as alipayPOST } from '../src/app/api/shop/payment/alipay/route'
import * as dbModule from '../src/lib/db'

function createLogoutRequest(headers: Record<string, string> = {}) {
  return new NextRequest('http://127.0.0.1:3000/api/admin/logout', {
    method: 'POST',
    headers,
  })
}

test('明文 HTTP 环境下登出 Set-Cookie 不带 Secure，保证删除指令被浏览器接受', async () => {
  const response = await logoutPOST(
    createLogoutRequest({ 'x-forwarded-proto': 'http' }),
  )
  const body = (await response.json()) as { success: boolean }
  const setCookie = response.headers.get('set-cookie') || ''

  assert.equal(response.status, 200)
  assert.equal(body.success, true)
  assert.match(setCookie, /auth-token=/)
  assert.match(setCookie, /Max-Age=0/)
  assert.doesNotMatch(setCookie, /Secure/i)
})

test('HTTPS 环境下登出 Set-Cookie 带 Secure，与登录口径一致', async () => {
  const response = await logoutPOST(
    createLogoutRequest({ 'x-forwarded-proto': 'https' }),
  )
  const setCookie = response.headers.get('set-cookie') || ''

  assert.equal(response.status, 200)
  assert.match(setCookie, /auth-token=/)
  assert.match(setCookie, /Max-Age=0/)
  assert.match(setCookie, /Secure/i)
})

test('伪造微信 XML 回调被拒绝（渠道验签未实现）', async (t) => {
  const originalConsoleError = console.error
  const originalConfigFindUnique = prisma.shopPaymentConfig.findUnique.bind(
    prisma.shopPaymentConfig,
  )
  console.error = () => undefined
  prisma.shopPaymentConfig.findUnique = (async () => ({
    id: 1,
    provider: 'wechat',
    configJson: '{}',
    isEnabled: true,
  })) as unknown as typeof prisma.shopPaymentConfig.findUnique
  t.after(() => {
    console.error = originalConsoleError
    prisma.shopPaymentConfig.findUnique = originalConfigFindUnique
  })

  const forgedXml = `<?xml version="1.0"?><xml><appid>wx555</appid>
<mch_id>1900000000</mch_id><out_trade_no>SO-FORGE-1</out_trade_no>
<total_fee>1000</total_fee><result_code>SUCCESS</result_code>
<sign>FAKESIGN</sign></xml>`

  const response = await wechatPOST(
    new NextRequest('http://127.0.0.1:3000/api/shop/payment/wechat', {
      method: 'POST',
      headers: { 'content-type': 'text/xml' },
      body: forgedXml,
    }),
  )
  const body = (await response.json()) as { success: boolean; message?: string }

  assert.equal(response.status, 400)
  assert.equal(body.success, false)
  assert.match(body.message ?? '', /验签未实现|已禁用回调/)
})

test('伪造支付宝表单回调被拒绝（渠道验签未实现）', async (t) => {
  const originalConsoleError = console.error
  const originalConfigFindUnique = prisma.shopPaymentConfig.findUnique.bind(
    prisma.shopPaymentConfig,
  )
  console.error = () => undefined
  prisma.shopPaymentConfig.findUnique = (async () => ({
    id: 2,
    provider: 'alipay',
    configJson: '{}',
    isEnabled: true,
  })) as unknown as typeof prisma.shopPaymentConfig.findUnique
  t.after(() => {
    console.error = originalConsoleError
    prisma.shopPaymentConfig.findUnique = originalConfigFindUnique
  })

  const response = await alipayPOST(
    new NextRequest('http://127.0.0.1:3000/api/shop/payment/alipay', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'out_trade_no=SO-FORGE-2&total_amount=10.00&trade_status=TRADE_SUCCESS&sign=FAKE&sign_type=RSA2',
    }),
  )
  const body = (await response.json()) as { success: boolean; message?: string }

  assert.equal(response.status, 400)
  assert.equal(body.success, false)
  assert.match(body.message ?? '', /验签未实现|已禁用回调/)
})
