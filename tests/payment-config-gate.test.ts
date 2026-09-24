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
import { GET, POST } from '../src/app/api/admin/shop/payment-configs/route'

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

test('已启用渠道仅提交配置（不带 isEnabled）时同样执行完整性校验（防空 key 绕过）', async (t) => {
  const originalFindUnique = prisma.systemConfig.findUnique.bind(prisma.systemConfig)
  const originalConfigFindUnique = prisma.shopPaymentConfig.findUnique.bind(
    prisma.shopPaymentConfig,
  )
  const originalUpsert = prisma.shopPaymentConfig.upsert.bind(prisma.shopPaymentConfig)
  let upsertCalled = false

  prisma.systemConfig.findUnique = (async () => null) as unknown as typeof prisma.systemConfig.findUnique
  // 存量行：yipay 已启用
  prisma.shopPaymentConfig.findUnique = (async () => ({
    id: 1,
    provider: 'yipay',
    isEnabled: true,
    configJson: JSON.stringify({ gateway: 'https://pay.example.com', pid: '1001', key: 'real-key' }),
  })) as unknown as typeof prisma.shopPaymentConfig.findUnique
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
  // 请求不带 isEnabled：攻击/误操作只提交空 key 的配置，渠道保持启用
  const request = createRequest(
    { provider: 'yipay', configJson: JSON.stringify({ key: '   ' }) },
    token,
  )

  const response = await POST(request)
  const body = (await response.json()) as { success: boolean; message: string; missingKeys?: string[] }

  assert.equal(response.status, 400)
  assert.equal(body.success, false)
  assert.match(body.message, /渠道配置不完整/)
  // gateway / pid / key 都缺失（空 key 按缺失处理）
  assert.deepEqual(body.missingKeys?.sort(), ['gateway', 'key', 'pid'])
  assert.equal(upsertCalled, false)
})

test('已启用渠道提交完整配置（不带 isEnabled）可正常保存', async (t) => {
  const originalFindUnique = prisma.systemConfig.findUnique.bind(prisma.systemConfig)
  const originalConfigFindUnique = prisma.shopPaymentConfig.findUnique.bind(
    prisma.shopPaymentConfig,
  )
  const originalUpsert = prisma.shopPaymentConfig.upsert.bind(prisma.shopPaymentConfig)
  let upsertCalled = false

  prisma.systemConfig.findUnique = (async () => null) as unknown as typeof prisma.systemConfig.findUnique
  prisma.shopPaymentConfig.findUnique = (async () => ({
    id: 1,
    provider: 'yipay',
    isEnabled: true,
    configJson: JSON.stringify({ gateway: 'https://pay.example.com', pid: '1001', key: 'old-key' }),
  })) as unknown as typeof prisma.shopPaymentConfig.findUnique
  prisma.shopPaymentConfig.upsert = (async () => {
    upsertCalled = true
    return { provider: 'yipay', isEnabled: true }
  }) as unknown as typeof prisma.shopPaymentConfig.upsert

  t.after(async () => {
    prisma.systemConfig.findUnique = originalFindUnique
    prisma.shopPaymentConfig.findUnique = originalConfigFindUnique
    prisma.shopPaymentConfig.upsert = originalUpsert
  })

  const token = await signToken({ username: 'admin', isAdmin: true })
  const request = createRequest(
    {
      provider: 'yipay',
      configJson: JSON.stringify({
        gateway: 'https://pay.example.com',
        pid: '1001',
        key: 'rotated-key',
      }),
    },
    token,
  )

  const response = await POST(request)
  const body = (await response.json()) as { success: boolean }

  assert.equal(response.status, 200)
  assert.equal(body.success, true)
  assert.equal(upsertCalled, true)
})

test('GET 回显敏感字段掩码，不泄露明文密钥', async (t) => {
  const originalFindUnique = prisma.systemConfig.findUnique.bind(prisma.systemConfig)
  const originalFindMany = prisma.shopPaymentConfig.findMany.bind(prisma.shopPaymentConfig)

  prisma.systemConfig.findUnique = (async () => null) as unknown as typeof prisma.systemConfig.findUnique
  prisma.shopPaymentConfig.findMany = (async () => [
    {
      provider: 'webhook',
      isEnabled: true,
      configJson: JSON.stringify({ secret: 'super-secret-value', url: 'https://example.com/notify' }),
    },
  ]) as unknown as typeof prisma.shopPaymentConfig.findMany

  t.after(async () => {
    prisma.systemConfig.findUnique = originalFindUnique
    prisma.shopPaymentConfig.findMany = originalFindMany
  })

  const token = await signToken({ username: 'admin', isAdmin: true })
  const request = new NextRequest('http://127.0.0.1:3000/api/admin/shop/payment-configs', {
    method: 'GET',
    headers: { cookie: `auth-token=${token}` },
  })

  const response = await GET(request)
  const body = (await response.json()) as {
    success: boolean
    configs: Array<{ provider: string; configJson: string; missingKeys: string[] }>
  }

  assert.equal(response.status, 200)
  assert.equal(body.success, true)
  const webhookConfig = body.configs.find((config) => config.provider === 'webhook')
  assert.ok(webhookConfig)
  assert.ok(!webhookConfig.configJson.includes('super-secret-value'), '明文密钥不得回显')
  assert.ok(webhookConfig.configJson.includes('******'), '敏感字段应为掩码')
  assert.ok(webhookConfig.configJson.includes('https://example.com/notify'), '非敏感字段正常回显')
  // 掩码占位按非空处理，不产生误报缺失
  assert.deepEqual(webhookConfig.missingKeys, [])
})

test('POST 掩码占位回传时还原存量真实密钥（查看后保存不冲掉密钥）', async (t) => {
  const originalFindUnique = prisma.systemConfig.findUnique.bind(prisma.systemConfig)
  const originalConfigFindUnique = prisma.shopPaymentConfig.findUnique.bind(
    prisma.shopPaymentConfig,
  )
  const originalUpsert = prisma.shopPaymentConfig.upsert.bind(prisma.shopPaymentConfig)
  let upsertConfigJson: string | null = null

  prisma.systemConfig.findUnique = (async () => null) as unknown as typeof prisma.systemConfig.findUnique
  prisma.shopPaymentConfig.findUnique = (async () => ({
    id: 1,
    provider: 'webhook',
    isEnabled: true,
    configJson: JSON.stringify({ secret: 'real-secret', url: 'https://example.com/notify' }),
  })) as unknown as typeof prisma.shopPaymentConfig.findUnique
  prisma.shopPaymentConfig.upsert = (async (args: Record<string, unknown>) => {
    const create = args.create as { configJson?: string } | undefined
    const update = args.update as { configJson?: string } | undefined
    upsertConfigJson = update?.configJson ?? create?.configJson ?? null
    return { provider: 'webhook', isEnabled: true }
  }) as unknown as typeof prisma.shopPaymentConfig.upsert

  t.after(async () => {
    prisma.systemConfig.findUnique = originalFindUnique
    prisma.shopPaymentConfig.findUnique = originalConfigFindUnique
    prisma.shopPaymentConfig.upsert = originalUpsert
  })

  const token = await signToken({ username: 'admin', isAdmin: true })
  // 前端把 GET 回显的掩码原样带回（只改了 url），secret 应还原为 real-secret
  const request = createRequest(
    {
      provider: 'webhook',
      isEnabled: true,
      configJson: JSON.stringify({ secret: '******', url: 'https://example.com/notify-v2' }),
    },
    token,
  )

  const response = await POST(request)
  const body = (await response.json()) as { success: boolean }

  assert.equal(response.status, 200)
  assert.equal(body.success, true)
  assert.ok(upsertConfigJson)
  const saved = JSON.parse(upsertConfigJson) as Record<string, string>
  assert.equal(saved.secret, 'real-secret')
  assert.equal(saved.url, 'https://example.com/notify-v2')
})

test('POST 成功后写入 PAYMENT_CONFIG_UPDATED 审计且不含配置内容', async (t) => {
  const originalFindUnique = prisma.systemConfig.findUnique.bind(prisma.systemConfig)
  const originalUpsert = prisma.shopPaymentConfig.upsert.bind(prisma.shopPaymentConfig)
  const originalAuditCreate = prisma.adminOperationAuditLog.create.bind(
    prisma.adminOperationAuditLog,
  )
  const auditPayloads: Array<Record<string, unknown>> = []

  prisma.systemConfig.findUnique = (async () => null) as unknown as typeof prisma.systemConfig.findUnique
  prisma.shopPaymentConfig.upsert = (async () => ({
    provider: 'webhook',
    isEnabled: true,
  })) as unknown as typeof prisma.shopPaymentConfig.upsert
  prisma.adminOperationAuditLog.create = (async (args: Record<string, unknown>) => {
    auditPayloads.push(args)
    return {}
  }) as unknown as typeof prisma.adminOperationAuditLog.create

  t.after(async () => {
    prisma.systemConfig.findUnique = originalFindUnique
    prisma.shopPaymentConfig.upsert = originalUpsert
    prisma.adminOperationAuditLog.create = originalAuditCreate
  })

  const token = await signToken({ username: 'admin', isAdmin: true })
  const request = createRequest(
    {
      provider: 'webhook',
      isEnabled: true,
      configJson: JSON.stringify({ secret: 'another-secret', url: 'https://example.com/x' }),
    },
    token,
  )

  const response = await POST(request)
  assert.equal(response.status, 200)

  assert.equal(auditPayloads.length, 1)
  const data = auditPayloads[0].data as Record<string, unknown>
  assert.equal(data.operationType, 'PAYMENT_CONFIG_UPDATED')
  assert.equal(data.adminUsername, 'admin')
  assert.equal(data.targetLabel, 'webhook')
  const detail = String(data.detailJson ?? '')
  assert.ok(!detail.includes('another-secret'), '审计不得包含配置内容')
  assert.ok(detail.includes('isEnabled'))
})
