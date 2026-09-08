import assert from 'node:assert/strict'
import test from 'node:test'

import { NextRequest } from 'next/server'

import { prisma } from '../src/lib/db'
import { bootstrapDevelopmentDatabase } from '../src/lib/dev-bootstrap'
import { clearConfigCache, setConfig } from '../src/lib/config-service'
import { setEmailTransportFactoryForTests } from '../src/lib/notification-email'
import { generateShopOrderNo } from '../src/lib/shop-order-service'
import { signToken } from '../src/lib/jwt'

const silentLogger = { log: () => undefined, error: () => undefined }

async function writeConfig(key: string, value: string | number) {
  await setConfig(key, value)
  clearConfigCache([key])
}

async function createAuthHeaders(): Promise<Record<string, string>> {
  const token = await signToken({ username: 'admin', isAdmin: true })
  return { cookie: `auth-token=${token}` }
}

test.before(async () => {
  await bootstrapDevelopmentDatabase({ logger: silentLogger })
})

test.after(async () => {
  await prisma.$disconnect()
})

test.afterEach(async () => {
  await prisma.shopProductCodeStock.deleteMany({})
  await prisma.shopOrder.deleteMany({})
  await prisma.shopProduct.deleteMany({})
  await prisma.notificationLog.deleteMany({})
  await prisma.adminOperationAuditLog.deleteMany({
    where: { operationType: 'SHOP_ORDER_RESEND_EMAIL' },
  })
  await prisma.systemConfig.deleteMany({
    where: { key: { in: ['notifyWebhookUrl', 'notifyEmailSmtpHost', 'notifyEmailTo'] } },
  })
  clearConfigCache()
  setEmailTransportFactoryForTests(null)
})

test('GET /api/admin/notifications/logs 返回投递日志（支持筛选）', async () => {
  const { GET } = await import('../src/app/api/admin/notifications/logs/route')

  await prisma.notificationLog.createMany({
    data: [
      {
        event: 'SHOP_ORDER_PAID_FULFILLED',
        channel: 'webhook',
        target: 'https://notify.example.com/hook',
        status: 'sent',
        relatedId: 'SO-LOG-001',
        payload: '{}',
      },
      {
        event: 'SHOP_ORDER_PAID_FULFILLED',
        channel: 'email',
        target: 'admin@example.com',
        status: 'failed',
        error: 'SMTP 发送失败',
        relatedId: 'SO-LOG-001',
      },
      {
        event: 'LICENSE_EXPIRED',
        channel: 'webhook',
        target: 'https://legacy.example.com/expiry',
        status: 'sent',
        relatedId: 'TIME-001',
      },
    ],
  })

  const response = await GET(
    new NextRequest('http://127.0.0.1:3000/api/admin/notifications/logs?channel=email', {
      headers: await createAuthHeaders(),
    }),
  )

  assert.equal(response.status, 200)
  const data = (await response.json()) as {
    success: boolean
    logs: Array<{ channel: string; status: string }>
    pagination: { total: number }
  }
  assert.equal(data.success, true)
  assert.equal(data.pagination.total, 1)
  assert.equal(data.logs[0].channel, 'email')
  assert.equal(data.logs[0].status, 'failed')
})


test('POST resend-email 携带真实卡密的已发卡订单成功发送', async () => {
  await writeConfig('notifyEmailSmtpHost', 'smtp.example.com')
  await writeConfig('notifyEmailTo', 'admin@example.com')

  const mails: Array<Record<string, unknown>> = []
  setEmailTransportFactoryForTests(() => ({
    async sendMail(mailOptions) {
      mails.push(mailOptions as Record<string, unknown>)
      return {}
    },
  }))

  const project = await prisma.project.findFirstOrThrow({ where: { projectKey: 'default' } })
  const product = await prisma.shopProduct.create({
    data: {
      name: '重发邮件真卡测试卡',
      projectId: project.id,
      licenseMode: 'COUNT',
      cardType: '次卡',
      totalCount: 10,
      priceInCents: 500,
      isEnabled: true,
      stockMode: 'DYNAMIC',
    },
  })

  const code = await prisma.activationCode.create({
    data: {
      code: `RESEND-CODE-${Date.now()}`,
      projectId: project.id,
      licenseMode: 'COUNT',
      totalCount: 10,
      cardType: '次卡',
    },
  })
  const order = await prisma.shopOrder.create({
    data: {
      orderNo: generateShopOrderNo(),
      productId: product.id,
      quantity: 1,
      amountInCents: 500,
      contactEmail: 'buyer-resend2@test.com',
      status: 'fulfilled',
      provider: 'manual',
      fulfilledCodeIds: JSON.stringify([code.id]),
    },
  })

  const { POST } = await import('../src/app/api/admin/shop/orders/[orderNo]/resend-email/route')
  const response = await POST(
    new NextRequest(`http://127.0.0.1:3000/api/admin/shop/orders/${order.orderNo}/resend-email`, {
      method: 'POST',
      headers: await createAuthHeaders(),
    }),
    { params: { orderNo: order.orderNo } } as never,
  )

  assert.equal(response.status, 200)
  const data = (await response.json()) as { success: boolean }
  assert.equal(data.success, true)
  assert.equal(mails.length, 1)
  assert.equal(mails[0].to, 'buyer-resend2@test.com')
  assert.match(String(mails[0].text), /RESEND-CODE-/)

  const auditCount = await prisma.adminOperationAuditLog.count({
    where: { operationType: 'SHOP_ORDER_RESEND_EMAIL', targetLabel: order.orderNo },
  })
  assert.ok(auditCount >= 1)
})

test('POST resend-email 未发卡订单返回 400；未留邮箱返回 400', async () => {
  const project = await prisma.project.findFirstOrThrow({ where: { projectKey: 'default' } })
  const product = await prisma.shopProduct.create({
    data: {
      name: '重发邮件边界测试卡',
      projectId: project.id,
      licenseMode: 'COUNT',
      cardType: '次卡',
      totalCount: 10,
      priceInCents: 500,
      isEnabled: true,
      stockMode: 'DYNAMIC',
    },
  })

  const pendingOrder = await prisma.shopOrder.create({
    data: {
      orderNo: generateShopOrderNo(),
      productId: product.id,
      quantity: 1,
      amountInCents: 500,
      contactEmail: 'pending@test.com',
      status: 'pending',
      provider: 'manual',
    },
  })
  const fulfilledNoEmail = await prisma.shopOrder.create({
    data: {
      orderNo: generateShopOrderNo(),
      productId: product.id,
      quantity: 1,
      amountInCents: 500,
      status: 'fulfilled',
      provider: 'manual',
    },
  })

  const { POST } = await import('../src/app/api/admin/shop/orders/[orderNo]/resend-email/route')

  const authHeaders = await createAuthHeaders()
  const pendingResponse = await POST(
    new NextRequest(`http://127.0.0.1:3000/api/admin/shop/orders/${pendingOrder.orderNo}/resend-email`, {
      method: 'POST',
      headers: authHeaders,
    }),
    { params: { orderNo: pendingOrder.orderNo } } as never,
  )
  assert.equal(pendingResponse.status, 400)

  const noEmailResponse = await POST(
    new NextRequest(`http://127.0.0.1:3000/api/admin/shop/orders/${fulfilledNoEmail.orderNo}/resend-email`, {
      method: 'POST',
      headers: authHeaders,
    }),
    { params: { orderNo: fulfilledNoEmail.orderNo } } as never,
  )
  assert.equal(noEmailResponse.status, 400)
})

test('POST resend-email 邮件渠道未配置时返回 502 提示', async () => {
  const project = await prisma.project.findFirstOrThrow({ where: { projectKey: 'default' } })
  const product = await prisma.shopProduct.create({
    data: {
      name: '重发邮件未配置测试卡',
      projectId: project.id,
      licenseMode: 'COUNT',
      cardType: '次卡',
      totalCount: 10,
      priceInCents: 500,
      isEnabled: true,
      stockMode: 'DYNAMIC',
    },
  })
  const code = await prisma.activationCode.create({
    data: {
      code: `RESEND-NOCONF-${Date.now()}`,
      projectId: project.id,
      licenseMode: 'COUNT',
      totalCount: 10,
      cardType: '次卡',
    },
  })
  const order = await prisma.shopOrder.create({
    data: {
      orderNo: generateShopOrderNo(),
      productId: product.id,
      quantity: 1,
      amountInCents: 500,
      contactEmail: 'noconf@test.com',
      status: 'fulfilled',
      provider: 'manual',
      fulfilledCodeIds: JSON.stringify([code.id]),
    },
  })

  const { POST } = await import('../src/app/api/admin/shop/orders/[orderNo]/resend-email/route')
  const response = await POST(
    new NextRequest(`http://127.0.0.1:3000/api/admin/shop/orders/${order.orderNo}/resend-email`, {
      method: 'POST',
      headers: await createAuthHeaders(),
    }),
    { params: { orderNo: order.orderNo } } as never,
  )

  assert.equal(response.status, 502)
  const data = (await response.json()) as { success: boolean; message?: string }
  assert.equal(data.success, false)
  assert.match(data.message ?? '', /邮件通知未配置/)
})

test('POST resend-email 订单不存在返回 404', async () => {
  const { POST } = await import('../src/app/api/admin/shop/orders/[orderNo]/resend-email/route')
  const response = await POST(
    new NextRequest('http://127.0.0.1:3000/api/admin/shop/orders/SO-NOT-EXIST/resend-email', {
      method: 'POST',
      headers: await createAuthHeaders(),
    }),
    { params: { orderNo: 'SO-NOT-EXIST' } } as never,
  )
  assert.equal(response.status, 404)
})
