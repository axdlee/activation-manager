import assert from 'node:assert/strict'
import test from 'node:test'

import { isShopEnabled } from '../src/lib/shop-access'
import { listAvailablePaymentChannels } from '../src/lib/shop-payment-registry'
import { prisma } from '../src/lib/db'
import { bootstrapDevelopmentDatabase } from '../src/lib/dev-bootstrap'
import { setConfig, clearConfigCache } from '../src/lib/config-service'

const silentLogger = { log: () => undefined, error: () => undefined }

test.before(async () => {
  await bootstrapDevelopmentDatabase({ logger: silentLogger })
})

test.after(async () => {
  await prisma.$disconnect()
})

test.afterEach(async () => {
  await prisma.shopProductCodeStock.deleteMany({})
  await prisma.shopProduct.deleteMany({})
  await prisma.shopOrder.deleteMany({})
  await prisma.shopPaymentConfig.deleteMany({})
  await prisma.systemConfig.deleteMany({ where: { key: 'shopEnabled' } })
  clearConfigCache(['shopEnabled'])
})

test('isShopEnabled 默认返回 true', async () => {
  assert.equal(await isShopEnabled(), true)
})

test('shopEnabled=false 时 isShopEnabled 返回 false', async () => {
  await setConfig('shopEnabled', false)
  clearConfigCache(['shopEnabled'])
  assert.equal(await isShopEnabled(), false)
})

test('未配置完整渠道不对外展示，manual 兜底可用', async () => {
  // yipay 启用但缺 key（配置不全）→ 不展示
  await prisma.shopPaymentConfig.create({
    data: {
      provider: 'yipay',
      configJson: JSON.stringify({ gateway: 'https://pay.example.com', pid: '1001' }), // 缺 key
      isEnabled: true,
    },
  })
  // manual 未显式禁用 → 兜底
  await prisma.shopPaymentConfig.create({
    data: { provider: 'manual', configJson: '{}', isEnabled: true },
  })

  const channels = await listAvailablePaymentChannels()
  const ids = channels.map((c) => c.id)
  assert.ok(ids.includes('manual'), 'manual 应在渠道列表')
  assert.ok(!ids.includes('yipay'), '配置不全的 yipay 不应展示')
})

test('yipay 配置完整后展示', async () => {
  await prisma.shopPaymentConfig.create({
    data: {
      provider: 'yipay',
      configJson: JSON.stringify({ gateway: 'https://pay.example.com', pid: '1001', key: 'k' }),
      isEnabled: true,
    },
  })
  await prisma.shopPaymentConfig.create({
    data: { provider: 'manual', configJson: '{}', isEnabled: true },
  })

  const channels = await listAvailablePaymentChannels()
  const ids = channels.map((c) => c.id)
  assert.ok(ids.includes('yipay'))
  assert.ok(ids.includes('manual'))
})

test('manual 被显式禁用且无其他渠道时列表为空', async () => {
  await prisma.shopPaymentConfig.create({
    data: { provider: 'manual', configJson: '{}', isEnabled: false },
  })

  const channels = await listAvailablePaymentChannels()
  assert.equal(channels.length, 0)
})
