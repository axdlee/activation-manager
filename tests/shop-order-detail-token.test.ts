/**
 * 批次3 订单详情访问令牌回归测试：
 * 订单号裸查不能再读出卡密，必须携带下单时签发的 accessToken。
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { NextRequest } from 'next/server'

import { prisma } from '../src/lib/db'
import { bootstrapDevelopmentDatabase } from '../src/lib/dev-bootstrap'
import { createShopOrder, SHOP_ORDER_STATUS } from '../src/lib/shop-order-service'
import { getShopOrderDetailRoute } from '../src/app/api/shop/orders/[orderNo]/route'

const silentLogger = { log: () => undefined, error: () => undefined }

test.before(async () => {
  await bootstrapDevelopmentDatabase({ logger: silentLogger })
})

test.after(async () => {
  await prisma.$disconnect()
})

test.afterEach(async () => {
  await prisma.activationCode.deleteMany({})
  await prisma.shopOrder.deleteMany({})
  await prisma.shopProduct.deleteMany({})
})

async function seedDynamicProduct() {
  const project = await prisma.project.findFirstOrThrow({ where: { projectKey: 'default' } })
  return prisma.shopProduct.create({
    data: {
      name: '令牌测试商品',
      description: '订单详情令牌测试',
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

function createDetailRequest(orderNo: string, token?: string) {
  const url = new URL(`http://127.0.0.1:3000/api/shop/orders/${orderNo}`)
  if (token !== undefined) {
    url.searchParams.set('token', token)
  }
  return new NextRequest(url)
}

async function fulfillOrder(orderId: number, codeId: number) {
  await prisma.shopOrder.update({
    where: { id: orderId },
    data: {
      status: SHOP_ORDER_STATUS.FULFILLED,
      paidAt: new Date(),
      fulfilledAt: new Date(),
      fulfilledCodeIds: JSON.stringify([codeId]),
    },
  })
  await prisma.activationCode.update({
    where: { id: codeId },
    data: { isUsed: true, usedAt: new Date() },
  })
}

async function createCode(projectId: number, code: string) {
  return prisma.activationCode.create({
    data: {
      code,
      projectId,
      licenseMode: 'COUNT',
      totalCount: 10,
      remainingCount: 10,
      consumedCount: 0,
    },
  })
}

test('下单签发 accessToken，未携带令牌的详情查询读不到卡密', async () => {
  const project = await prisma.project.findFirstOrThrow({ where: { projectKey: 'default' } })
  const product = await seedDynamicProduct()
  const { order } = await createShopOrder({
    productId: product.id,
    quantity: 1,
    providerId: 'manual',
    contactEmail: 'buyer@example.com',
  })

  assert.equal(typeof order.accessToken, 'string')
  assert.equal((order.accessToken as string).length, 32)
  assert.match(order.accessToken as string, /^[0-9a-f]{32}$/)

  const code = await createCode(project.id, 'TOKEN-TEST-CODE-1')
  await fulfillOrder(order.id, code.id)

  // 无令牌：订单状态可见，卡密不可见
  const noTokenResponse = await getShopOrderDetailRoute(
    createDetailRequest(order.orderNo),
    { params: { orderNo: order.orderNo } },
    prisma,
  )
  const noTokenBody = (await noTokenResponse.json()) as {
    success: boolean
    order: { status: string }
    codes: Array<{ code: string }>
  }
  assert.equal(noTokenResponse.status, 200)
  assert.equal(noTokenBody.success, true)
  assert.equal(noTokenBody.order.status, 'fulfilled')
  assert.deepEqual(noTokenBody.codes, [])

  // 错误令牌：同样读不到卡密
  const wrongTokenResponse = await getShopOrderDetailRoute(
    createDetailRequest(order.orderNo, '0'.repeat(32)),
    { params: { orderNo: order.orderNo } },
    prisma,
  )
  const wrongTokenBody = (await wrongTokenResponse.json()) as { codes: Array<{ code: string }> }
  assert.deepEqual(wrongTokenBody.codes, [])

  // 正确令牌：读到卡密
  const okResponse = await getShopOrderDetailRoute(
    createDetailRequest(order.orderNo, order.accessToken as string),
    { params: { orderNo: order.orderNo } },
    prisma,
  )
  const okBody = (await okResponse.json()) as { codes: Array<{ code: string }> }
  assert.deepEqual(
    okBody.codes.map((item) => item.code),
    [code.code],
  )
})

test('历史订单（无 accessToken）即使伪造 token 也读不到卡密', async () => {
  const project = await prisma.project.findFirstOrThrow({ where: { projectKey: 'default' } })
  const product = await seedDynamicProduct()
  const { order } = await createShopOrder({
    productId: product.id,
    quantity: 1,
    providerId: 'manual',
    contactEmail: 'buyer@example.com',
  })

  // 模拟历史行：清空 accessToken
  await prisma.shopOrder.update({
    where: { id: order.id },
    data: { accessToken: null },
  })

  const code = await createCode(project.id, 'TOKEN-LEGACY-CODE')
  await fulfillOrder(order.id, code.id)

  const response = await getShopOrderDetailRoute(
    createDetailRequest(order.orderNo, 'guess'),
    { params: { orderNo: order.orderNo } },
    prisma,
  )
  const body = (await response.json()) as { codes: Array<{ code: string }> }
  assert.deepEqual(body.codes, [])
})
