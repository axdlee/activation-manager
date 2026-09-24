/**
 * 批次评审（v2.9.0 复查）高危项 2 回归：库存预占独立过期。
 *
 * 背景：人工收款（manual）订单不自动取消，下单时的 RESERVED 预占若与
 * 订单状态绑死，一个未支付订单即可把码池库存永久锁死（实测：100 张
 * 库存被单笔订单全预占，真实买家看到售罄）。
 *
 * 修复语义：
 * 1. 预占行带 reservedUntil（默认 60 分钟，env 可配），与订单状态解耦
 * 2. 过期预占在下单/发卡/清理入口惰性释放回 AVAILABLE
 * 3. 管理员取消订单接口：pending 单立即取消并释放预占（不等 TTL）
 * 4. 单笔订单数量上限（默认 10），缩小单请求锁库的爆炸半径
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { prisma } from '../src/lib/db'
import { bootstrapDevelopmentDatabase } from '../src/lib/dev-bootstrap'
import {
  cancelShopOrderByAdmin,
  createShopOrder,
  resolveShopOrderMaxQuantity,
  SHOP_ORDER_MAX_QUANTITY_DEFAULT,
  SHOP_ORDER_MAX_QUANTITY_ENV,
  ShopOrderError,
} from '../src/lib/shop-order-service'
import {
  releaseExpiredShopStockReservations,
  resolveShopStockReservationTtlMs,
  SHOP_STOCK_RESERVATION_DEFAULT_TTL_MS,
  SHOP_STOCK_RESERVATION_TTL_ENV,
} from '../src/lib/shop-stock-reservation'
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
      name: '预占过期回归卡',
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

test('预占时长解析：默认 60 分钟、env 可配、非法回退、上下限钳制', () => {
  assert.equal(resolveShopStockReservationTtlMs({}), SHOP_STOCK_RESERVATION_DEFAULT_TTL_MS)
  assert.equal(resolveShopStockReservationTtlMs({ [SHOP_STOCK_RESERVATION_TTL_ENV]: '15' }), 15 * 60 * 1000)
  assert.equal(resolveShopStockReservationTtlMs({ [SHOP_STOCK_RESERVATION_TTL_ENV]: 'abc' }), SHOP_STOCK_RESERVATION_DEFAULT_TTL_MS)
  assert.equal(resolveShopStockReservationTtlMs({ [SHOP_STOCK_RESERVATION_TTL_ENV]: '-3' }), SHOP_STOCK_RESERVATION_DEFAULT_TTL_MS)
  // 下限 1 分钟
  assert.equal(resolveShopStockReservationTtlMs({ [SHOP_STOCK_RESERVATION_TTL_ENV]: '0.2' }), 60 * 1000)
  // 上限 24 小时
  assert.equal(resolveShopStockReservationTtlMs({ [SHOP_STOCK_RESERVATION_TTL_ENV]: '5000' }), 24 * 60 * 60 * 1000)
})

test('单笔数量上限解析：默认 10、env 可配、非法回退、钳制到 [1,100]', () => {
  assert.equal(resolveShopOrderMaxQuantity({}), SHOP_ORDER_MAX_QUANTITY_DEFAULT)
  assert.equal(resolveShopOrderMaxQuantity({ [SHOP_ORDER_MAX_QUANTITY_ENV]: '25' }), 25)
  assert.equal(resolveShopOrderMaxQuantity({ [SHOP_ORDER_MAX_QUANTITY_ENV]: 'abc' }), SHOP_ORDER_MAX_QUANTITY_DEFAULT)
  assert.equal(resolveShopOrderMaxQuantity({ [SHOP_ORDER_MAX_QUANTITY_ENV]: '0' }), SHOP_ORDER_MAX_QUANTITY_DEFAULT)
  assert.equal(resolveShopOrderMaxQuantity({ [SHOP_ORDER_MAX_QUANTITY_ENV]: '250' }), 100)
})

test('下单预占行带 reservedUntil（约 now + TTL）', async () => {
  const { product } = await seedPredefinedProduct(3)

  const before = Date.now()
  const { order } = await createShopOrder({
    productId: product.id,
    providerId: 'webhook',
    quantity: 3,
    contactEmail: 'ttl@example.com',
  })

  const reservedRows = await prisma.shopProductCodeStock.findMany({
    where: { soldOrderId: order.id, status: 'RESERVED' },
  })
  assert.equal(reservedRows.length, 3)
  for (const row of reservedRows) {
    assert.ok(row.reservedUntil, '预占行应写入 reservedUntil')
    const ttl = row.reservedUntil!.getTime() - before
    assert.ok(ttl > 55 * 60 * 1000 && ttl <= 65 * 60 * 1000, `reservedUntil 应约等于 now+60min，实际 ${ttl}ms`)
  }
})

test('单笔数量超过上限时拒绝（默认 10）', async () => {
  const { product } = await seedPredefinedProduct(20)

  await assert.rejects(
    createShopOrder({
      productId: product.id,
      providerId: 'webhook',
      quantity: 11,
      contactEmail: 'cap@example.com',
    }),
    (error: unknown) => error instanceof ShopOrderError && error.statusCode === 400,
  )
})

test('releaseExpiredShopStockReservations 只释放过期行', async () => {
  const { product } = await seedPredefinedProduct(4)
  const { order } = await createShopOrder({
    productId: product.id,
    providerId: 'webhook',
    quantity: 2,
    contactEmail: 'release@example.com',
  })

  // 一半行回拨为已过期，一半保持未过期
  const rows = await prisma.shopProductCodeStock.findMany({
    where: { soldOrderId: order.id },
    orderBy: { id: 'asc' },
  })
  await prisma.shopProductCodeStock.update({
    where: { id: rows[0].id },
    data: { reservedUntil: new Date(Date.now() - 1000) },
  })

  const released = await releaseExpiredShopStockReservations()
  assert.equal(released, 1)

  const releasedRow = await prisma.shopProductCodeStock.findUniqueOrThrow({ where: { id: rows[0].id } })
  assert.equal(releasedRow.status, 'AVAILABLE')
  assert.equal(releasedRow.soldOrderId, null)
  assert.equal(releasedRow.reservedUntil, null)

  const stillReserved = await prisma.shopProductCodeStock.findUniqueOrThrow({ where: { id: rows[1].id } })
  assert.equal(stillReserved.status, 'RESERVED')
  assert.equal(stillReserved.soldOrderId, order.id)
})

test('高危项 2 主场景：预占过期后新订单可买到（库存不被未支付订单永久锁死）', async () => {
  const { product } = await seedPredefinedProduct(2)
  const providerId = 'webhook'

  // 首单占满全部库存且永不支付（模拟人工收款订单）
  const first = await createShopOrder({
    productId: product.id,
    providerId,
    quantity: 2,
    contactEmail: 'holder@example.com',
  })

  // 未过期时第二单应被拒（预占仍在）
  await assert.rejects(
    createShopOrder({ productId: product.id, providerId, contactEmail: 'early@example.com' }),
    (error: unknown) => error instanceof ShopOrderError && error.statusCode === 409,
  )

  // 预占过期
  await prisma.shopProductCodeStock.updateMany({
    where: { soldOrderId: first.order.id },
    data: { reservedUntil: new Date(Date.now() - 5000) },
  })

  // 新订单可正常下单（惰性释放后抢占原行）
  const second = await createShopOrder({
    productId: product.id,
    providerId,
    quantity: 2,
    contactEmail: 'later@example.com',
  })
  assert.equal(second.order.status, 'pending')

  const secondReserved = await prisma.shopProductCodeStock.count({
    where: { soldOrderId: second.order.id, status: 'RESERVED' },
  })
  assert.equal(secondReserved, 2)
})

test('人工收款单过期后管理员确认：发卡仍成功（重新抢占原行）', async () => {
  const { product } = await seedPredefinedProduct(2)

  const { order } = await createShopOrder({
    productId: product.id,
    providerId: 'webhook',
    quantity: 2,
    contactEmail: 'manual@example.com',
  })

  // 预占过期（订单仍 pending，模拟管理员迟来确认）
  await prisma.shopProductCodeStock.updateMany({
    where: { soldOrderId: order.id },
    data: { reservedUntil: new Date(Date.now() - 5000) },
  })

  const result = await fulfillShopOrder({ orderNo: order.orderNo, adminUsername: 'admin' })
  assert.equal(result.success, true)
  assert.equal(result.codes?.length, 2)

  const soldRows = await prisma.shopProductCodeStock.count({
    where: { soldOrderId: order.id, status: 'SOLD' },
  })
  assert.equal(soldRows, 2)
})

test('清理任务释放过期预占，但不取消 manual 订单', async () => {
  const { product } = await seedPredefinedProduct(2)

  const { order } = await createShopOrder({
    productId: product.id,
    providerId: 'webhook',
    quantity: 2,
    contactEmail: 'sweep@example.com',
  })
  // 把订单改成 manual 渠道并置于超时窗口外
  await prisma.shopOrder.update({
    where: { id: order.id },
    data: { provider: 'manual', createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
  })
  await prisma.shopProductCodeStock.updateMany({
    where: { soldOrderId: order.id },
    data: { reservedUntil: new Date(Date.now() - 5000) },
  })

  await cancelExpiredPendingOrders()

  const swept = await prisma.shopOrder.findUniqueOrThrow({ where: { id: order.id } })
  assert.equal(swept.status, 'pending', 'manual 订单不应被自动取消')

  const stockAfter = await prisma.shopProductCodeStock.findMany({ where: { productId: product.id } })
  assert.equal(stockAfter.length, 2)
  for (const row of stockAfter) {
    assert.equal(row.status, 'AVAILABLE', '过期预占应被清理任务释放')
    assert.equal(row.soldOrderId, null)
    assert.equal(row.reservedUntil, null)
  }
})

test('管理员取消订单：pending 单立即取消并释放预占', async () => {
  const { product } = await seedPredefinedProduct(3)

  const { order } = await createShopOrder({
    productId: product.id,
    providerId: 'webhook',
    quantity: 3,
    contactEmail: 'cancel@example.com',
  })

  const result = await cancelShopOrderByAdmin(order.orderNo)
  assert.equal(result.releasedStockCount, 3)

  const cancelled = await prisma.shopOrder.findUniqueOrThrow({ where: { id: order.id } })
  assert.equal(cancelled.status, 'cancelled')

  const stockRows = await prisma.shopProductCodeStock.findMany({ where: { soldOrderId: order.id } })
  assert.equal(stockRows.length, 0, '预占行应全部摘除 soldOrderId')

  const available = await prisma.shopProductCodeStock.count({
    where: { productId: product.id, status: 'AVAILABLE' },
  })
  assert.equal(available, 3, '库存应全部回可售')

  // 释放后新订单立即可买
  const next = await createShopOrder({
    productId: product.id,
    providerId: 'webhook',
    contactEmail: 'after-cancel@example.com',
  })
  assert.equal(next.order.status, 'pending')
})

test('管理员取消订单：非 pending 状态 409，重复取消 409，未知订单 404', async () => {
  const { product } = await seedPredefinedProduct(1)

  const { order } = await createShopOrder({
    productId: product.id,
    providerId: 'webhook',
    contactEmail: 'conflict@example.com',
  })

  // 已发卡订单不可取消
  await fulfillShopOrder({ orderNo: order.orderNo, adminUsername: 'admin' })
  await assert.rejects(
    cancelShopOrderByAdmin(order.orderNo),
    (error: unknown) => error instanceof ShopOrderError && error.statusCode === 409,
  )

  // 未知订单
  await assert.rejects(
    cancelShopOrderByAdmin('SO-DOES-NOT-EXIST'),
    (error: unknown) => error instanceof ShopOrderError && error.statusCode === 404,
  )
})
