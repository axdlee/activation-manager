/**
 * 批次3（v2.9.0 复查中危）回归：并发支付回调孤儿码回收。
 *
 * 修复前：动态发卡的码在事务外预生成，并发回调中输掉的请求生成的码
 * 不回收 → 3 个并发回调、5 张订单：生成 15 张，挂单 5 张，
 * 10 张有效无主孤儿码（实测）。
 * 修复后：输掉抢占 / 状态冲突 / 业务与异常路径一律回收本请求
 * 预生成且未被采用的码（只删 isUsed=false，不影响赢家的码）。
 *
 * 真实 SQLite 集成：3 个并发 fulfillShopOrder 抢同一 pending 订单。
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { prisma } from '../src/lib/db'
import { bootstrapDevelopmentDatabase } from '../src/lib/dev-bootstrap'
import { createShopOrder } from '../src/lib/shop-order-service'
import { fulfillShopOrder } from '../src/lib/shop-fulfillment-service'

const silentLogger = { log: () => undefined, error: () => undefined }

test.before(async () => {
  await bootstrapDevelopmentDatabase({ logger: silentLogger })
})

test.after(async () => {
  await prisma.$disconnect()
})

test.beforeEach(async () => {
  // 首个测试运行前也要清库：dev.db 可能有其他测试/调试残留的同项目码
  await prisma.activationCode.deleteMany({})
  await prisma.shopOrder.deleteMany({})
  await prisma.shopProduct.deleteMany({})
  await prisma.shopPaymentConfig.deleteMany({})
})

test.afterEach(async () => {
  await prisma.activationCode.deleteMany({})
  await prisma.shopOrder.deleteMany({})
  await prisma.shopProduct.deleteMany({})
  await prisma.shopPaymentConfig.deleteMany({})
})

async function seedDynamicProduct() {
  await prisma.shopPaymentConfig.upsert({
    where: { provider: 'webhook' },
    update: { isEnabled: true },
    create: { provider: 'webhook', configJson: '{}', isEnabled: true },
  })
  const project = await prisma.project.findFirstOrThrow({ where: { projectKey: 'default' } })
  return prisma.shopProduct.create({
    data: {
      name: '孤儿码回收测试商品',
      description: '并发回调孤儿码回收',
      projectId: project.id,
      priceInCents: 100,
      stockMode: 'DYNAMIC',
      cardType: '次卡',
      licenseMode: 'COUNT',
      totalCount: 10,
      isEnabled: true,
    },
  })
}

test('并发回调：输掉的请求预生成码全部回收，库内无有效无主孤儿码', async () => {
  const product = await seedDynamicProduct()
  const project = await prisma.project.findFirstOrThrow({ where: { projectKey: 'default' } })

  const { order } = await createShopOrder({
    productId: product.id,
    providerId: 'webhook',
    quantity: 5,
    contactEmail: 'orphan@example.com',
  })

  // 复现支付网关重复通知：3 个并发回调抢同一 pending 订单
  const results = await Promise.allSettled(
    Array.from({ length: 3 }, () =>
      fulfillShopOrder({ orderNo: order.orderNo, transactionId: 'txn-orphan' }),
    ),
  )

  const settled = results
    .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof fulfillShopOrder>>> => r.status === 'fulfilled')
  // 至少一次成功发卡
  const succeeded = settled.filter((r) => r.value.success)
  assert.ok(succeeded.length >= 1, '至少一个回调应发卡成功')

  const fulfilledOrder = await prisma.shopOrder.findUniqueOrThrow({ where: { orderNo: order.orderNo } })
  assert.equal(fulfilledOrder.status, 'fulfilled')
  const attachedIds = JSON.parse(fulfilledOrder.fulfilledCodeIds ?? '[]') as number[]
  assert.equal(attachedIds.length, 5, '订单应挂上 5 张码')

  // 关键断言：库内该项目码总数 == 挂单数（孤儿全部回收）
  const totalCodes = await prisma.activationCode.count({ where: { projectId: project.id } })
  assert.equal(totalCodes, 5, `并发输家预生成的码应被回收，实际库内 ${totalCodes} 张（期望 5）`)

  // 无「有效且无主」的码：每张码都在订单 fulfilledCodeIds 上
  const unclaimed = await prisma.activationCode.count({
    where: { projectId: project.id, id: { notIn: attachedIds } },
  })
  assert.equal(unclaimed, 0, '不应存在未挂单的孤儿码')
})

test('串行重复回调：不产生孤儿码（alreadyProcessed 路径同样回收）', async () => {
  const product = await seedDynamicProduct()
  const project = await prisma.project.findFirstOrThrow({ where: { projectKey: 'default' } })

  const { order } = await createShopOrder({
    productId: product.id,
    providerId: 'webhook',
    quantity: 3,
    contactEmail: 'serial@example.com',
  })

  const first = await fulfillShopOrder({ orderNo: order.orderNo, transactionId: 'txn-1' })
  assert.equal(first.success, true)

  // 已 fulfilled 订单早退，不预生成码 → 直接 alreadyProcessed
  const second = await fulfillShopOrder({ orderNo: order.orderNo, transactionId: 'txn-1' })
  assert.equal(second.success, true)
  assert.equal(second.alreadyProcessed, true)

  const totalCodes = await prisma.activationCode.count({ where: { projectId: project.id } })
  assert.equal(totalCodes, 3)
})
