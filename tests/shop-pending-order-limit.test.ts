/**
 * v2.11.0 评审批次 3（中危）：库存预占滥用上限。
 *
 * 背景：预占已带 reservedUntil 过期（v2.10.0），但同一攻击者仍可
 * 「3 笔订单 × 单笔上限 10 张 → 锁 30 张库存 60 分钟」循环轰炸：
 * 每轮锁满→等过期→再锁。本轮加「待支付订单频控」：
 * - 同一联系方式（邮箱/手机/微信任一命中）pending 单数 ≤ 上限（默认 3）
 * - 同一下单 IP（server.js 追加后的真实来源）pending 单数 ≤ 上限（默认 10）
 * 超限 409，已支付/已取消/已履约订单不占额度。
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { prisma } from '../src/lib/db'
import { bootstrapDevelopmentDatabase } from '../src/lib/dev-bootstrap'
import { generateActivationCodes } from '../src/lib/license-generation-service'
import {
  createShopOrder,
  resolveShopMaxPendingOrdersPerContact,
  resolveShopMaxPendingOrdersPerIp,
  SHOP_MAX_PENDING_ORDERS_PER_CONTACT_DEFAULT,
  SHOP_MAX_PENDING_ORDERS_PER_CONTACT_ENV,
  SHOP_MAX_PENDING_ORDERS_PER_IP_DEFAULT,
  SHOP_MAX_PENDING_ORDERS_PER_IP_ENV,
  ShopOrderError,
} from '../src/lib/shop-order-service'

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
  await prisma.activationCode.deleteMany({})
})

async function seedProduct(stockMode: 'DYNAMIC' | 'PREDEFINED') {
  await prisma.shopPaymentConfig.upsert({
    where: { provider: 'webhook' },
    update: { isEnabled: true },
    create: { provider: 'webhook', configJson: '{}', isEnabled: true },
  })
  const defaultProject = await prisma.project.findFirstOrThrow({ where: { projectKey: 'default' } })
  const product = await prisma.shopProduct.create({
    data: {
      name: `待支付上限回归卡-${stockMode}`,
      projectId: defaultProject.id,
      licenseMode: 'TIME',
      cardType: '时间卡',
      validDays: 30,
      priceInCents: 990,
      isEnabled: true,
      stockMode,
    },
  })

  if (stockMode === 'PREDEFINED') {
    // 预定义码商品需要真实码池库存，否则会在频控之前先撞「库存不足」
    const codes = await generateActivationCodes(prisma, {
      projectKey: 'default',
      amount: 8,
      licenseMode: 'TIME',
      validDays: 30,
    })
    for (const code of codes) {
      await prisma.shopProductCodeStock.create({
        data: { productId: product.id, activationCodeId: code.id, status: 'AVAILABLE' },
      })
    }
  }

  return product
}

function createOrder(product: { id: number }, overrides: Record<string, unknown> = {}) {
  return createShopOrder(
    {
      productId: product.id,
      providerId: 'webhook',
      quantity: 1,
      contactEmail: 'buyer@example.com',
      clientIp: '203.0.113.9',
      ...overrides,
    },
  )
}

test('待支付上限解析：联系方式默认 3、IP 默认 10，env 可配并钳制', () => {
  assert.equal(resolveShopMaxPendingOrdersPerContact({}), SHOP_MAX_PENDING_ORDERS_PER_CONTACT_DEFAULT)
  assert.equal(resolveShopMaxPendingOrdersPerContact({ [SHOP_MAX_PENDING_ORDERS_PER_CONTACT_ENV]: '5' }), 5)
  assert.equal(resolveShopMaxPendingOrdersPerContact({ [SHOP_MAX_PENDING_ORDERS_PER_CONTACT_ENV]: 'abc' }), SHOP_MAX_PENDING_ORDERS_PER_CONTACT_DEFAULT)
  assert.equal(resolveShopMaxPendingOrdersPerContact({ [SHOP_MAX_PENDING_ORDERS_PER_CONTACT_ENV]: '0' }), SHOP_MAX_PENDING_ORDERS_PER_CONTACT_DEFAULT)
  assert.equal(resolveShopMaxPendingOrdersPerContact({ [SHOP_MAX_PENDING_ORDERS_PER_CONTACT_ENV]: '500' }), 100)

  assert.equal(resolveShopMaxPendingOrdersPerIp({}), SHOP_MAX_PENDING_ORDERS_PER_IP_DEFAULT)
  assert.equal(resolveShopMaxPendingOrdersPerIp({ [SHOP_MAX_PENDING_ORDERS_PER_IP_ENV]: '50' }), 50)
  assert.equal(resolveShopMaxPendingOrdersPerIp({ [SHOP_MAX_PENDING_ORDERS_PER_IP_ENV]: '-1' }), SHOP_MAX_PENDING_ORDERS_PER_IP_DEFAULT)
  assert.equal(resolveShopMaxPendingOrdersPerIp({ [SHOP_MAX_PENDING_ORDERS_PER_IP_ENV]: '5000' }), 1000)
})

test('同一邮箱 pending 单达到上限后 409（默认 3 笔）', async () => {
  const product = await seedProduct('DYNAMIC')
  for (let index = 0; index < 3; index += 1) {
    await createOrder(product)
  }
  await assert.rejects(
    () => createOrder(product, { contactEmail: 'buyer@example.com' }),
    (error: unknown) => {
      assert.ok(error instanceof ShopOrderError)
      assert.equal(error.statusCode, 409)
      assert.match(error.message, /待支付订单过多/)
      return true
    },
  )
})

test('任一联系方式维度命中即拒：不同邮箱但同手机号 409', async () => {
  const product = await seedProduct('DYNAMIC')
  for (let index = 0; index < 3; index += 1) {
    await createOrder(product, { contactEmail: `round${index}@example.com`, contactPhone: '13800001111' })
  }
  await assert.rejects(
    () => createOrder(product, { contactEmail: 'fresh@example.com', contactPhone: '13800001111' }),
    (error: unknown) => {
      assert.ok(error instanceof ShopOrderError)
      assert.equal(error.statusCode, 409)
      return true
    },
  )
})

test('同一下单 IP pending 单达到上限后 409（默认 10 笔），换 IP 不受限', async () => {
  const product = await seedProduct('DYNAMIC')
  for (let index = 0; index < 10; index += 1) {
    await createOrder(product, { contactEmail: `ipuser${index}@example.com` })
  }
  await assert.rejects(
    () => createOrder(product, { contactEmail: 'overflow@example.com' }),
    (error: unknown) => {
      assert.ok(error instanceof ShopOrderError)
      assert.equal(error.statusCode, 409)
      return true
    },
  )
  // 换 IP 后同一邮箱策略下可继续下单（IP 与联系方式是并列维度）
  const order = await createOrder(product, { contactEmail: 'other-ip@example.com', clientIp: '198.51.100.77' })
  assert.equal(order.order.clientIp, '198.51.100.77')
})

test('已支付订单不占额度：支付 1 笔后可继续下单', async () => {
  const product = await seedProduct('DYNAMIC')
  const first = await createOrder(product)
  await prisma.shopOrder.update({
    where: { id: first.order.id },
    data: { status: 'paid', paidAt: new Date() },
  })
  const second = await createOrder(product)
  assert.ok(second.order.id > 0)
})

test('管理员取消订单不占额度：取消后可继续下单', async () => {
  const product = await seedProduct('DYNAMIC')
  for (let index = 0; index < 3; index += 1) {
    await createOrder(product)
  }
  const oldest = await prisma.shopOrder.findFirstOrThrow({ orderBy: { id: 'asc' } })
  await prisma.shopOrder.update({ where: { id: oldest.id }, data: { status: 'cancelled' } })
  const order = await createOrder(product)
  assert.ok(order.order.id > 0)
})

test('PREDEFINED 商品同样受限，且下单 IP 落库', async () => {
  const product = await seedProduct('PREDEFINED')
  for (let index = 0; index < 3; index += 1) {
    await createOrder(product, { contactEmail: 'pre@example.com' })
  }
  await assert.rejects(
    () => createOrder(product, { contactEmail: 'pre@example.com' }),
    (error: unknown) => {
      assert.ok(error instanceof ShopOrderError)
      assert.equal(error.statusCode, 409)
      return true
    },
  )
  const stored = await prisma.shopOrder.findFirstOrThrow({ orderBy: { id: 'asc' } })
  assert.equal(stored.clientIp, '203.0.113.9')
})

test('env 收紧联系方式上限：SHOP_MAX_PENDING_ORDERS_PER_CONTACT=1 时第 2 笔 409', async () => {
  const original = process.env[SHOP_MAX_PENDING_ORDERS_PER_CONTACT_ENV]
  process.env[SHOP_MAX_PENDING_ORDERS_PER_CONTACT_ENV] = '1'
  try {
    const product = await seedProduct('DYNAMIC')
    await createOrder(product, { contactEmail: 'tight@example.com' })
    await assert.rejects(
      () => createOrder(product, { contactEmail: 'tight@example.com' }),
      (error: unknown) => {
        assert.ok(error instanceof ShopOrderError)
        assert.equal(error.statusCode, 409)
        return true
      },
    )
  } finally {
    if (original === undefined) {
      delete process.env[SHOP_MAX_PENDING_ORDERS_PER_CONTACT_ENV]
    } else {
      process.env[SHOP_MAX_PENDING_ORDERS_PER_CONTACT_ENV] = original
    }
  }
})
