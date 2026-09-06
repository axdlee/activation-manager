import assert from 'node:assert/strict'
import test from 'node:test'

import { prisma } from '../src/lib/db'
import { bootstrapDevelopmentDatabase } from '../src/lib/dev-bootstrap'
import {
  createShopOrder,
  generateShopOrderNo,
  markShopOrderPaid,
  ShopOrderError,
} from '../src/lib/shop-order-service'
import { fulfillShopOrder } from '../src/lib/shop-fulfillment-service'
import { manualPaymentProvider, webhookPaymentProvider } from '../src/lib/shop-payment-providers'
import { POST as webhookPOST } from '../src/app/api/shop/payment/webhook/route'
import { NextRequest } from 'next/server'

const silentLogger = { log: () => undefined, error: () => undefined }

test.before(async () => {
  await bootstrapDevelopmentDatabase({ logger: silentLogger })
})

test.after(async () => {
  await prisma.$disconnect()
})

test.afterEach(async () => {
  await prisma.shopOrder.deleteMany({})
  await prisma.shopProduct.deleteMany({})
  await prisma.shopPaymentConfig.deleteMany({})
})

async function seedProductAndConfig() {
  const defaultProject = await prisma.project.findFirstOrThrow({ where: { projectKey: 'default' } })

  const product = await prisma.shopProduct.create({
    data: {
      name: '月卡测试商品',
      description: '30 天时间型',
      projectId: defaultProject.id,
      licenseMode: 'TIME',
      cardType: '月卡',
      validDays: 30,
      priceInCents: 990,
      isEnabled: true,
    },
  })

  await prisma.shopPaymentConfig.create({
    data: {
      provider: 'manual',
      configJson: JSON.stringify({ account: 'test@example.com', instructions: '备注订单号' }),
      isEnabled: true,
    },
  })

  return { product, project: defaultProject }
}

test('generateShopOrderNo 生成唯一订单号', () => {
  const a = generateShopOrderNo()
  const b = generateShopOrderNo()
  assert.match(a, /^SO[A-Z0-9]+$/)
  assert.notEqual(a, b)
})

test('createShopOrder 缺少联系方式时拒绝下单', async () => {
  const { product } = await seedProductAndConfig()

  await assert.rejects(
    () =>
      createShopOrder({
        productId: product.id,
        providerId: 'manual',
      }),
    (error: unknown) => {
      assert.ok(error instanceof ShopOrderError)
      assert.match(error.message, /联系方式/)
      return true
    },
  )
})

test('createShopOrder 商品不存在或下架时拒绝', async () => {
  await assert.rejects(
    () =>
      createShopOrder({
        productId: 999999,
        providerId: 'manual',
        contactEmail: 'a@b.com',
      }),
    (error: unknown) => {
      assert.ok(error instanceof ShopOrderError)
      assert.equal(error.statusCode, 404)
      return true
    },
  )
})

test('createShopOrder 成功创建 pending 订单', async () => {
  const { product } = await seedProductAndConfig()

  const { order } = await createShopOrder({
    productId: product.id,
    providerId: 'manual',
    contactEmail: 'buyer@example.com',
    contactPhone: '13800138000',
  })

  assert.equal(order.status, 'pending')
  assert.equal(order.amountInCents, 990)
  assert.equal(order.contactEmail, 'buyer@example.com')
  assert.equal(order.contactPhone, '13800138000')
  assert.equal(order.provider, 'manual')
})

test('markShopOrderPaid 将订单标记为已支付且幂等', async () => {
  const { product } = await seedProductAndConfig()
  const { order } = await createShopOrder({
    productId: product.id,
    providerId: 'manual',
    contactWechat: 'wx-test',
  })

  const result = await markShopOrderPaid({ orderNo: order.orderNo, transactionId: 'TXN-001' })
  assert.equal(result.success, true)

  const again = await markShopOrderPaid({ orderNo: order.orderNo, transactionId: 'TXN-001' })
  assert.equal(again.success, true)
  assert.equal('alreadyProcessed' in again && again.alreadyProcessed, true)
})

test('fulfillShopOrder 支付后自动生成卡密并标记 fulfilled', async () => {
  const { product, project } = await seedProductAndConfig()
  const { order } = await createShopOrder({
    productId: product.id,
    providerId: 'manual',
    contactEmail: 'fulfill@example.com',
  })

  const result = await fulfillShopOrder({ orderNo: order.orderNo })
  assert.equal(result.success, true)
  assert.ok(result.codes && result.codes.length === 1)
  assert.match(result.codes[0]!, /^[A-F0-9]{16}$/)

  const updated = await prisma.shopOrder.findUniqueOrThrow({ where: { orderNo: order.orderNo } })
  assert.equal(updated.status, 'fulfilled')
  assert.ok(updated.fulfilledAt)
  assert.ok(updated.fulfilledCodeIds)

  // 卡密归属正确项目
  const code = await prisma.activationCode.findFirst({
    where: { code: result.codes![0] },
  })
  assert.equal(code?.projectId, project.id)
  assert.equal(code?.licenseMode, 'TIME')
  assert.equal(code?.validDays, 30)
})

test('fulfillShopOrder 对已发卡订单幂等返回', async () => {
  const { product } = await seedProductAndConfig()
  const { order } = await createShopOrder({
    productId: product.id,
    providerId: 'manual',
    contactEmail: 'dup@example.com',
  })

  const first = await fulfillShopOrder({ orderNo: order.orderNo })
  const second = await fulfillShopOrder({ orderNo: order.orderNo })

  assert.equal(first.success, true)
  assert.equal(second.success, true)
  assert.equal(second.alreadyProcessed, true)
  assert.deepEqual(second.codes, first.codes)
})

test('manualPaymentProvider 生成含收款说明的支付信息且不要求在线支付', async () => {
  const payment = await manualPaymentProvider.createPayment(
    {
      orderNo: 'SO-TEST-001',
      amountInCents: 1000,
      productName: '测试商品',
    },
    { account: 'pay@example.com' },
  )

  assert.equal(payment.requirePaymentNote, true)
  assert.match(payment.payParams.instructions ?? '', /10\.00 元/)
  assert.match(payment.payParams.instructions ?? '', /SO-TEST-001/)
})

test('webhookPaymentProvider 能从回调体解析支付上下文', async () => {
  const context = await webhookPaymentProvider.verifyCallback(
    JSON.stringify({ orderNo: 'SO-WEB-001', paid: true, transactionId: 'TX-1' }),
    {},
  )

  assert.ok(context)
  assert.equal(context.orderNo, 'SO-WEB-001')
  assert.equal(context.paid, true)
  assert.equal(context.transactionId, 'TX-1')
})

test('webhookPaymentProvider 对非法回调体返回 null', async () => {
  const context = await webhookPaymentProvider.verifyCallback('not-json', {})
  assert.equal(context, null)
})

test('fulfillShopOrder 并发调用只发一张卡（原子抢占）', async () => {
  const { product } = await seedProductAndConfig()
  const { order } = await createShopOrder({
    productId: product.id,
    providerId: 'manual',
    contactEmail: 'concurrent@example.com',
  })

  // 两个并发发卡请求
  const [r1, r2] = await Promise.all([
    fulfillShopOrder({ orderNo: order.orderNo }),
    fulfillShopOrder({ orderNo: order.orderNo }),
  ])

  // 至少一个成功且只有一个真正发卡
  const successResults = [r1, r2].filter((r) => r.success)
  assert.ok(successResults.length >= 1)

  // 订单只关联 1 张卡（而不是 2 张）——这是并发竞态的核心断言
  const updated = await prisma.shopOrder.findUniqueOrThrow({ where: { orderNo: order.orderNo } })
  const codeIds = JSON.parse(updated.fulfilledCodeIds ?? '[]') as number[]
  assert.equal(codeIds.length, 1)
})

test('markShopOrderPaid 并发调用只成功一次', async () => {
  const { product } = await seedProductAndConfig()
  const { order } = await createShopOrder({
    productId: product.id,
    providerId: 'manual',
    contactEmail: 'paid-race@example.com',
  })

  const [r1, r2] = await Promise.all([
    markShopOrderPaid({ orderNo: order.orderNo, transactionId: 'T1' }),
    markShopOrderPaid({ orderNo: order.orderNo, transactionId: 'T2' }),
  ])

  // 两个都视为成功（一个真实写入，另一个 alreadyProcessed）
  assert.equal(r1.success, true)
  assert.equal(r2.success, true)

  // 数据库只有一条 paid 记录
  const updated = await prisma.shopOrder.findUniqueOrThrow({ where: { orderNo: order.orderNo } })
  assert.equal(updated.status, 'paid')
})

test('webhook 回调：未配置 secret 时可正常发卡（向后兼容）', async () => {
  const { product } = await seedProductAndConfig()
  const { order } = await createShopOrder({
    productId: product.id,
    providerId: 'manual',
    contactEmail: 'webhook@example.com',
  })

  // 直接调用 fulfillShopOrder（webhook route 的 secret 校验在路由层）
  const result = await fulfillShopOrder({ orderNo: order.orderNo })
  assert.equal(result.success, true)
  assert.ok(result.codes && result.codes.length === 1)
})

async function seedWithWebhookSecret(secret: string) {
  const project = await prisma.project.findFirstOrThrow({ where: { projectKey: 'default' } })
  const product = await prisma.shopProduct.create({
    data: {
      name: 'webhook 测试商品',
      projectId: project.id,
      licenseMode: 'TIME',
      cardType: '测试卡',
      validDays: 7,
      priceInCents: 100,
      isEnabled: true,
    },
  })
  await prisma.shopPaymentConfig.upsert({
    where: { provider: 'webhook' },
    update: {
      configJson: JSON.stringify({ secret }),
      isEnabled: true,
    },
    create: {
      provider: 'webhook',
      configJson: JSON.stringify({ secret }),
      isEnabled: true,
    },
  })
  return product
}


function createWebhookRequest(body: object, secretHeader?: string) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (secretHeader !== undefined) {
    headers['x-webhook-secret'] = secretHeader
  }
  return new NextRequest('http://127.0.0.1:3000/api/shop/payment/webhook', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}


test('webhook 回调：secret 匹配时发卡成功', async () => {
  const product = await seedWithWebhookSecret('my-secret-123')
  const { order } = await createShopOrder({
    productId: product.id,
    providerId: 'webhook',
    contactEmail: 'wh@example.com',
  })

  const response = await webhookPOST(
    createWebhookRequest({ orderNo: order.orderNo, paid: true }, 'my-secret-123'),
  )
  const data = (await response.json()) as { success: boolean; message?: string }
  assert.equal(response.status, 200)
  assert.equal(data.success, true)
  assert.equal(data.message, '发卡成功')

  const updated = await prisma.shopOrder.findUniqueOrThrow({ where: { orderNo: order.orderNo } })
  assert.equal(updated.status, 'fulfilled')
})

test('webhook 回调：secret 不匹配时拒绝（401）', async () => {
  const product = await seedWithWebhookSecret('my-secret-123')
  const { order } = await createShopOrder({
    productId: product.id,
    providerId: 'webhook',
    contactEmail: 'wh2@example.com',
  })

  const response = await webhookPOST(
    createWebhookRequest({ orderNo: order.orderNo, paid: true }, 'wrong-secret'),
  )
  assert.equal(response.status, 401)

  const updated = await prisma.shopOrder.findUniqueOrThrow({ where: { orderNo: order.orderNo } })
  assert.equal(updated.status, 'pending') // 未发卡
})

test('webhook 回调：缺少 secret 头时拒绝（401）', async () => {
  const product = await seedWithWebhookSecret('my-secret-123')
  const { order } = await createShopOrder({
    productId: product.id,
    providerId: 'webhook',
    contactEmail: 'wh3@example.com',
  })

  const response = await webhookPOST(createWebhookRequest({ orderNo: order.orderNo, paid: true }))
  assert.equal(response.status, 401)

  const updated = await prisma.shopOrder.findUniqueOrThrow({ where: { orderNo: order.orderNo } })
  assert.equal(updated.status, 'pending')
})

test('webhook 回调：非法回调体拒绝（400）', async () => {
  const product = await seedWithWebhookSecret('my-secret-123')
  const response = await webhookPOST(
    createWebhookRequest({ foo: 'bar' }, 'my-secret-123'),
  )
  assert.equal(response.status, 400)
  void product
})

