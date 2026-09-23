/**
 * 支付渠道启用安全闸门（回调整改批次）：
 * 1) placeholder 渠道（alipay/wechat）禁止启用
 * 2) webhook 必须配置 secret 才能启用
 * 3) 合法配置可正常启用
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { NextRequest } from 'next/server'

import * as dbModule from '../src/lib/db'
import { signToken } from '../src/lib/jwt'
import { POST } from '../src/app/api/admin/shop/payment-configs/route'

const { prisma } = dbModule

function createRequest(body: Record<string, unknown>, token: string) {
  return new NextRequest('http://127.0.0.1:3000/api/admin/shop/payment-configs', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: `auth-token=${token}`,
    },
    body: JSON.stringify(body),
  })
}

test('placeholder 渠道（alipay）禁止启用，伪造回调无法借道发卡', async (t) => {
  const originalFindUnique = prisma.systemConfig.findUnique.bind(prisma.systemConfig)
  const originalUpsert = prisma.shopPaymentConfig.upsert.bind(prisma.shopPaymentConfig)
  let upsertCalled = false

  prisma.systemConfig.findUnique = (async () => null) as unknown as typeof prisma.systemConfig.findUnique
  prisma.shopPaymentConfig.upsert = (async () => {
    upsertCalled = true
    return {}
  }) as unknown as typeof prisma.shopPaymentConfig.upsert

  t.after(async () => {
    prisma.systemConfig.findUnique = originalFindUnique
    prisma.shopPaymentConfig.upsert = originalUpsert
  })

  const token = await signToken({ username: 'admin', isAdmin: true })
  const request = createRequest({ provider: 'alipay', isEnabled: true }, token)

  const response = await POST(request)
  const body = (await response.json()) as { success: boolean; message: string }

  assert.equal(response.status, 400)
  assert.equal(body.success, false)
  assert.match(body.message, /回调验签尚未实现/)
  assert.equal(upsertCalled, false)
})

test('webhook 未配置 secret 时禁止启用', async (t) => {
  const originalFindUnique = prisma.systemConfig.findUnique.bind(prisma.systemConfig)
  const originalConfigFindUnique = prisma.shopPaymentConfig.findUnique.bind(
    prisma.shopPaymentConfig,
  )
  const originalUpsert = prisma.shopPaymentConfig.upsert.bind(prisma.shopPaymentConfig)
  let upsertCalled = false

  prisma.systemConfig.findUnique = (async () => null) as unknown as typeof prisma.systemConfig.findUnique
  prisma.shopPaymentConfig.findUnique = (async () => null) as unknown as typeof prisma.shopPaymentConfig.findUnique
  prisma.shopPaymentConfig.upsert = (async () => {
    upsertCalled = true
    return {}
  }) as unknown as typeof prisma.shopPaymentConfig.upsert

  t.after(async () => {
    prisma.systemConfig.findUnique = originalFindUnique
    prisma.shopPaymentConfig.findUnique = originalConfigFindUnique
    prisma.shopPaymentConfig.upsert = originalUpsert
  })

  const token = await signToken({ username: 'admin', isAdmin: true })
  const request = createRequest({ provider: 'webhook', isEnabled: true }, token)

  const response = await POST(request)
  const body = (await response.json()) as { success: boolean; message: string; missingKeys?: string[] }

  assert.equal(response.status, 400)
  assert.equal(body.success, false)
  assert.match(body.message, /渠道配置不完整/)
  assert.deepEqual(body.missingKeys, ['secret'])
  assert.equal(upsertCalled, false)
})

test('webhook 配置齐 secret 后可正常启用', async (t) => {
  const originalFindUnique = prisma.systemConfig.findUnique.bind(prisma.systemConfig)
  const originalUpsert = prisma.shopPaymentConfig.upsert.bind(prisma.shopPaymentConfig)
  let upsertPayload: Record<string, unknown> | null = null

  prisma.systemConfig.findUnique = (async () => null) as unknown as typeof prisma.systemConfig.findUnique
  prisma.shopPaymentConfig.upsert = (async (args: Record<string, unknown>) => {
    upsertPayload = args
    return { provider: 'webhook', isEnabled: true }
  }) as unknown as typeof prisma.shopPaymentConfig.upsert

  t.after(async () => {
    prisma.systemConfig.findUnique = originalFindUnique
    prisma.shopPaymentConfig.upsert = originalUpsert
  })

  const token = await signToken({ username: 'admin', isAdmin: true })
  const request = createRequest(
    {
      provider: 'webhook',
      isEnabled: true,
      configJson: JSON.stringify({ secret: 'unit-test-secret', url: 'https://example.com/notify' }),
    },
    token,
  )

  const response = await POST(request)
  const body = (await response.json()) as { success: boolean }

  assert.equal(response.status, 200)
  assert.equal(body.success, true)
  assert.ok(upsertPayload)
})
