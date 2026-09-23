/**
 * 发卡安全校验（回调整改批次）：
 * 1) 回调渠道与订单渠道不一致 → 拒绝发卡
 * 2) 回调金额与订单金额不一致 → 拒绝发卡
 * 3) 渠道+金额一致且订单已发卡 → 幂等返回（不重复发卡）
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import * as dbModule from '../src/lib/db'
import { fulfillShopOrder } from '../src/lib/shop-fulfillment-service'
import { SHOP_ORDER_STATUS } from '../src/lib/shop-order-service'

const { prisma } = dbModule

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 11,
    orderNo: 'SO-TEST-0001',
    provider: 'manual',
    amountInCents: 1000,
    status: SHOP_ORDER_STATUS.PAID,
    paidAt: new Date('2026-09-24T00:00:00.000Z'),
    paymentNote: null,
    fulfilledCodeIds: null as string | null,
    product: { id: 1, name: '测试商品', project: { id: 1, projectKey: 'demo' } },
    ...overrides,
  }
}

function installOrderMock(order: Record<string, unknown> | null) {
  const originalFindUnique = prisma.shopOrder.findUnique.bind(prisma.shopOrder)
  prisma.shopOrder.findUnique = (async () => order) as unknown as typeof prisma.shopOrder.findUnique
  return () => {
    prisma.shopOrder.findUnique = originalFindUnique
  }
}

test('回调渠道与订单支付渠道不一致时拒绝发卡', async (t) => {
  const restore = installOrderMock(makeOrder())
  let transactionCalled = false
  const originalTransaction = prisma.$transaction.bind(prisma)
  prisma.$transaction = (async () => {
    transactionCalled = true
    throw new Error('不应进入发卡事务')
  }) as unknown as typeof prisma.$transaction

  t.after(() => {
    restore()
    prisma.$transaction = originalTransaction
  })

  const result = await fulfillShopOrder({
    orderNo: 'SO-TEST-0001',
    expectedProvider: 'alipay',
  })

  assert.equal(result.success, false)
  assert.match(result.message ?? '', /渠道不一致/)
  assert.equal(transactionCalled, false)
})

test('回调金额与订单金额不一致时拒绝发卡', async (t) => {
  const restore = installOrderMock(makeOrder())
  let transactionCalled = false
  const originalTransaction = prisma.$transaction.bind(prisma)
  prisma.$transaction = (async () => {
    transactionCalled = true
    throw new Error('不应进入发卡事务')
  }) as unknown as typeof prisma.$transaction

  t.after(() => {
    restore()
    prisma.$transaction = originalTransaction
  })

  const result = await fulfillShopOrder({
    orderNo: 'SO-TEST-0001',
    expectedProvider: 'manual',
    expectedAmountInCents: 100,
  })

  assert.equal(result.success, false)
  assert.match(result.message ?? '', /金额不一致/)
  assert.equal(transactionCalled, false)
})

test('渠道与金额一致且订单已发卡时幂等返回已发卡码', async (t) => {
  const restore = installOrderMock(
    makeOrder({
      status: SHOP_ORDER_STATUS.FULFILLED,
      fulfilledCodeIds: '[101,102]',
    }),
  )
  const originalFindMany = prisma.activationCode.findMany.bind(prisma.activationCode)
  prisma.activationCode.findMany = (async () => [
    { id: 101, code: 'CODE-101' },
    { id: 102, code: 'CODE-102' },
  ]) as unknown as typeof prisma.activationCode.findMany

  t.after(() => {
    restore()
    prisma.activationCode.findMany = originalFindMany
  })

  const result = await fulfillShopOrder({
    orderNo: 'SO-TEST-0001',
    expectedProvider: 'manual',
    expectedAmountInCents: 1000,
  })

  assert.equal(result.success, true)
  assert.equal(result.alreadyProcessed, true)
  assert.deepEqual(result.codes, ['CODE-101', 'CODE-102'])
})
