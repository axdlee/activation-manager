/**
 * 批次2 防超卖预占回归测试：
 * 1. PREDEFINED 下单即预占码池库存（AVAILABLE → RESERVED + soldOrderId）
 * 2. 只剩 1 张码时第二单被拒绝（修复前只查数量不预占，两单都成功、付款后撞售罄）
 * 3. 超时取消后释放预占（RESERVED → AVAILABLE）
 * 4. 发卡优先消费本单预占的行
 * 5. 他单预占的行不会被兜底路径抢走
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { prisma } from '../src/lib/db'
import { bootstrapDevelopmentDatabase } from '../src/lib/dev-bootstrap'
import { createShopOrder, generateShopOrderNo, ShopOrderError } from '../src/lib/shop-order-service'
import { fulfillShopOrder } from '../src/lib/shop-fulfillment-service'
import { cancelExpiredPendingOrders } from '../src/lib/shop-order-cleanup-service'
import { generateActivationCodes } from '../src/lib/license-generation-service'

const silentLogger = { log: () => undefined, error: () => undefined }

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
  await prisma.shopPaymentConfig.deleteMany({})
})

async function seedPredefinedProduct(totalCount = 5) {
  await prisma.shopPaymentConfig.upsert({
    where: { provider: 'webhook' },
    update: { isEnabled: true },
    create: { provider: 'webhook', configJson: '{}', isEnabled: true },
  })
  const defaultProject = await prisma.project.findFirstOrThrow({ where: { projectKey: 'default' } })
  const codes = await generateActivationCodes(prisma, {
    projectKey: 'default',
    amount: totalCount,
    licenseMode: 'TIME',
    validDays: 30,
  })

  const product = await prisma.shopProduct.create({
    data: {
      name: '预占回归卡',
      projectId: defaultProject.id,
      licenseMode: 'TIME',
      cardType: '时间卡',
      validDays: 30,
      priceInCents: 990,
      isEnabled: true,
      stockMode: 'PREDEFINED',
    },
  })

  for (const code of codes) {
    await prisma.shopProductCodeStock.create({
      data: { productId: product.id, activationCodeId: code.id, status: 'AVAILABLE' },
    })
  }

  return { product, codes }
}

test('PREDEFINED 下单预占库存：单张码时第二单 409', async () => {
  const { product, codes } = await seedPredefinedProduct(1)

  const first = await createShopOrder({
    productId: product.id,
    providerId: 'webhook',
    contactEmail: 'first@example.com',
  })
  assert.equal(first.order.status, 'pending')

  // 首单已预占唯一的码
  const reservedStock = await prisma.shopProductCodeStock.findFirstOrThrow({
    where: { productId: product.id },
  })
  assert.equal(reservedStock.status, 'RESERVED')
  assert.equal(reservedStock.soldOrderId, first.order.id)

  // 第二单：码池已无 AVAILABLE 库存，必须被拒（修复前会成功创建、付款后无卡可发）
  await assert.rejects(
    () =>
      createShopOrder({
        productId: product.id,
        providerId: 'webhook',
        contactEmail: 'second@example.com',
      }),
    (error: unknown) => {
      assert.ok(error instanceof ShopOrderError)
      assert.equal(error.statusCode, 409)
      assert.match(error.message, /售罄|库存不足/)
      return true
    },
  )

  // 发卡消费的正是首单预占的那张码
  const result = await fulfillShopOrder({ orderNo: first.order.orderNo })
  assert.equal(result.success, true)
  assert.deepEqual(result.codes, [codes[0]!.code])
  const soldStock = await prisma.shopProductCodeStock.findFirstOrThrow({
    where: { productId: product.id },
  })
  assert.equal(soldStock.status, 'SOLD')
})

test('超时取消释放预占库存', async () => {
  const { product } = await seedPredefinedProduct(2)

  const { order } = await createShopOrder({
    productId: product.id,
    providerId: 'webhook',
    contactEmail: 'timeout@example.com',
  })

  // 回溯创建时间使其超时
  await prisma.shopOrder.update({
    where: { id: order.id },
    data: { createdAt: new Date(Date.now() - 40 * 60 * 1000) },
  })

  const result = await cancelExpiredPendingOrders()
  assert.equal(result.cancelled, 1)

  const cancelled = await prisma.shopOrder.findUniqueOrThrow({ where: { id: order.id } })
  assert.equal(cancelled.status, 'cancelled')

  // 预占的两张码全部释放回可售
  const stocks = await prisma.shopProductCodeStock.findMany({
    where: { productId: product.id },
  })
  assert.equal(stocks.length, 2)
  for (const stock of stocks) {
    assert.equal(stock.status, 'AVAILABLE')
    assert.equal(stock.soldOrderId, null)
  }
})

test('manual 人工收款订单不参与超时自动取消', async () => {
  const { product } = await seedPredefinedProduct(1)

  await prisma.shopPaymentConfig.upsert({
    where: { provider: 'manual' },
    update: { isEnabled: true },
    create: { provider: 'manual', configJson: '{}', isEnabled: true },
  })

  const { order } = await createShopOrder({
    productId: product.id,
    providerId: 'manual',
    contactEmail: 'manual-kept@example.com',
    paymentNote: '后台待确认收款',
  })
  await prisma.shopOrder.update({
    where: { id: order.id },
    data: { createdAt: new Date(Date.now() - 40 * 60 * 1000) },
  })

  await cancelExpiredPendingOrders()

  const kept = await prisma.shopOrder.findUniqueOrThrow({ where: { id: order.id } })
  assert.equal(kept.status, 'pending')
  const stock = await prisma.shopProductCodeStock.findFirstOrThrow({
    where: { productId: product.id },
  })
  assert.equal(stock.status, 'RESERVED')
})

test('他单预占的库存不会被兜底路径抢走', async () => {
  const { product, codes } = await seedPredefinedProduct(1)

  // 订单 A 正常下单并预占唯一的码
  const a = await createShopOrder({
    productId: product.id,
    providerId: 'webhook',
    contactEmail: 'a@example.com',
  })

  // 订单 B 伪造为「已支付」（无预占行，走存量兜底路径）
  await prisma.shopOrder.create({
    data: {
      orderNo: generateShopOrderNo(),
      productId: product.id,
      quantity: 1,
      amountInCents: 990,
      contactEmail: 'b@example.com',
      status: 'paid',
      provider: 'webhook',
    },
  })

  const b = await prisma.shopOrder.findFirstOrThrow({ where: { contactEmail: 'b@example.com' } })
  const result = await fulfillShopOrder({ orderNo: b.orderNo })
  assert.equal(result.success, false)
  assert.match(result.message ?? '', /售罄/)

  // B 回到 paid，A 的预占码原封不动
  const afterB = await prisma.shopOrder.findUniqueOrThrow({ where: { id: b.id } })
  assert.equal(afterB.status, 'paid')
  const stock = await prisma.shopProductCodeStock.findFirstOrThrow({
    where: { productId: product.id },
  })
  assert.equal(stock.status, 'RESERVED')
  assert.equal(stock.soldOrderId, a.order.id)

  // A 随后付款可正常发卡
  const aResult = await fulfillShopOrder({ orderNo: a.order.orderNo })
  assert.equal(aResult.success, true)
  assert.deepEqual(aResult.codes, [codes[0]!.code])
})
