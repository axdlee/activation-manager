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
