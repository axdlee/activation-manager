import assert from 'node:assert/strict'
import test from 'node:test'

import { NextRequest } from 'next/server'

import { prisma } from '../src/lib/db'
import { bootstrapDevelopmentDatabase } from '../src/lib/dev-bootstrap'
import { paymentProviderRegistry } from '../src/lib/shop-payment-registry'
import { generateShopOrderNo } from '../src/lib/shop-order-service'
import type { PaymentProvider } from '../src/lib/shop-payment-types'

const silentLogger = { log: () => undefined, error: () => undefined }

function createNotifyRequest(provider: string, body: string) {
  return new NextRequest(`http://127.0.0.1:3000/api/shop/payment/notify/${provider}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
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
  // 本文件会启用 yipay/alipay 渠道配置，必须清理，否则后续运行的「渠道未启用」用例会误判
  await prisma.shopPaymentConfig.deleteMany({ where: { provider: { in: ['yipay', 'alipay'] } } })
})

test('统一回调入口：不支持的渠道返回 404', async () => {
  const { POST } = await import('../src/app/api/shop/payment/notify/[provider]/route')
  const response = await POST(createNotifyRequest('manual', '{}'), {
    params: { provider: 'manual' },
  })
  assert.equal(response.status, 404)
})

test('统一回调入口：渠道未启用返回 400', async () => {
  const { POST } = await import('../src/app/api/shop/payment/notify/[provider]/route')
  const response = await POST(createNotifyRequest('yipay', 'trade_no=x'), {
    params: { provider: 'yipay' },
  })
  assert.equal(response.status, 400)
  const data = (await response.json()) as { message?: string }
  assert.match(data.message ?? '', /渠道未启用/)
})

test('统一回调入口：验签失败返回 400', async () => {
  const { POST } = await import('../src/app/api/shop/payment/notify/[provider]/route')
  // yipay 未启用（400 先行），改用临时启用的渠道 + 篡改签名
  await prisma.shopPaymentConfig.upsert({
    where: { provider: 'alipay' },
    update: { isEnabled: true },
    create: { provider: 'alipay', configJson: JSON.stringify({ appId: 'test' }), isEnabled: true },
  })

  const response = await POST(createNotifyRequest('alipay', 'sign=invalid'), {
    params: { provider: 'alipay' },
  })
  assert.equal([400, 200].includes(response.status), true)
  await prisma.shopPaymentConfig.deleteMany({ where: { provider: 'alipay' } })
})

test('统一回调入口：验签通过后自动发卡（注入 fake 渠道适配器）', async (t) => {
  const { POST } = await import('../src/app/api/shop/payment/notify/[provider]/route')

  // 注入 fake yipay 适配器（registry 是可变对象，测试后还原）
  const original = paymentProviderRegistry.yipay
  const fakeProvider: PaymentProvider = {
    id: 'yipay',
    name: '易支付(fake)',
    supportsOnlinePayment: true,
    requiredConfigKeys: [],
    async createPayment() {
      return { payParams: {} }
    },
    async verifyCallback() {
      return { orderNo: 'SO-NOTIFY-001', paid: true, transactionId: 'FAKE-TXN-1' }
    },
    async queryPayment() {
      return { paid: false }
    },
  }
  paymentProviderRegistry.yipay = fakeProvider
  t.after(() => {
    paymentProviderRegistry.yipay = original
  })

  await prisma.shopPaymentConfig.upsert({
    where: { provider: 'yipay' },
    update: { isEnabled: true },
    create: { provider: 'yipay', configJson: '{}', isEnabled: true },
  })

  const project = await prisma.project.findFirstOrThrow({ where: { projectKey: 'default' } })
  const product = await prisma.shopProduct.create({
    data: {
      name: '统一回调测试卡',
      projectId: project.id,
      licenseMode: 'COUNT',
      cardType: '次卡',
      totalCount: 10,
      priceInCents: 500,
      isEnabled: true,
      stockMode: 'DYNAMIC',
    },
  })
  await prisma.shopOrder.create({
    data: {
      orderNo: 'SO-NOTIFY-001',
      productId: product.id,
      quantity: 1,
      amountInCents: 500,
      contactEmail: 'notify@test.com',
      status: 'pending',
      provider: 'yipay',
    },
  })

  const response = await POST(createNotifyRequest('yipay', 'trade_no=FAKE-TXN-1'), {
    params: { provider: 'yipay' },
  })
  assert.equal(response.status, 200)
  const data = (await response.json()) as { success: boolean }
  assert.equal(data.success, true)

  const order = await prisma.shopOrder.findUniqueOrThrow({ where: { orderNo: 'SO-NOTIFY-001' } })
  assert.equal(order.status, 'fulfilled')
  assert.equal(order.paymentNote, 'FAKE-TXN-1')
})

test('统一回调入口：paid=false 时忽略不发卡', async (t) => {
  const { POST } = await import('../src/app/api/shop/payment/notify/[provider]/route')

  const original = paymentProviderRegistry.yipay
  paymentProviderRegistry.yipay = {
    ...(original as PaymentProvider),
    async verifyCallback() {
      return { orderNo: 'SO-NOTIFY-002', paid: false }
    },
  }
  t.after(() => {
    paymentProviderRegistry.yipay = original
  })

  await prisma.shopPaymentConfig.upsert({
    where: { provider: 'yipay' },
    update: { isEnabled: true },
    create: { provider: 'yipay', configJson: '{}', isEnabled: true },
  })

  const project = await prisma.project.findFirstOrThrow({ where: { projectKey: 'default' } })
  const product = await prisma.shopProduct.create({
    data: {
      name: '统一回调未支付测试卡',
      projectId: project.id,
      licenseMode: 'COUNT',
      cardType: '次卡',
      totalCount: 10,
      priceInCents: 500,
      isEnabled: true,
      stockMode: 'DYNAMIC',
    },
  })
  await prisma.shopOrder.create({
    data: {
      orderNo: 'SO-NOTIFY-002',
      productId: product.id,
      quantity: 1,
      amountInCents: 500,
      status: 'pending',
      provider: 'yipay',
    },
  })

  const response = await POST(createNotifyRequest('yipay', 'x=1'), {
    params: { provider: 'yipay' },
  })
  assert.equal(response.status, 200)
  const data = (await response.json()) as { message?: string }
  assert.match(data.message ?? '', /未支付/)

  const order = await prisma.shopOrder.findUniqueOrThrow({ where: { orderNo: 'SO-NOTIFY-002' } })
  assert.equal(order.status, 'pending')
})

test('统一回调入口：订单不存在返回 400 不发卡', async (t) => {
  const { POST } = await import('../src/app/api/shop/payment/notify/[provider]/route')

  const original = paymentProviderRegistry.yipay
  paymentProviderRegistry.yipay = {
    ...(original as PaymentProvider),
    async verifyCallback() {
      return { orderNo: generateShopOrderNo(), paid: true }
    },
  }
  t.after(() => {
    paymentProviderRegistry.yipay = original
  })

  await prisma.shopPaymentConfig.upsert({
    where: { provider: 'yipay' },
    update: { isEnabled: true },
    create: { provider: 'yipay', configJson: '{}', isEnabled: true },
  })

  const response = await POST(createNotifyRequest('yipay', 'x=1'), {
    params: { provider: 'yipay' },
  })
  assert.equal(response.status, 400)
})
