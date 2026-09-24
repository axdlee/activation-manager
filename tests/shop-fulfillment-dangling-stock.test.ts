/**
 * 批次1 高危修复回归测试（临时 SQLite 集成）：
 * 1. 悬空码池库存：管理员删除激活码后留下的库存行不再卡死发卡
 *    （修复前 findUniqueOrThrow 每次抛错 → 已付款订单 500）
 * 2. 关闭设备绑定后 COUNT 码二次激活（修复前被误判「已被其他设备使用」）
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { PrismaClient } from '@prisma/client'

import { bootstrapDevelopmentDatabase } from '../src/lib/dev-bootstrap'
import { fulfillShopOrder } from '../src/lib/shop-fulfillment-service'
import { generateActivationCodes } from '../src/lib/license-generation-service'
import { activateCountLicense } from '../src/lib/license-activation-flow-service'

const silentLogger = { log: () => undefined, error: () => undefined }

async function createTestPrisma() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'activation-manager-fulfill-'))
  const dbPath = path.join(tempDir, 'dev.db')

  await bootstrapDevelopmentDatabase({ dbPath, logger: silentLogger })

  const prisma = new PrismaClient({
    datasources: { db: { url: `file:${dbPath}` } },
  })

  return { prisma, cleanup: () => fs.rmSync(tempDir, { recursive: true, force: true }) }
}

const NON_EXISTENT_CODE_ID = 999999

test('悬空码池库存被跳过并清理，订单正常发卡', async () => {
  const { prisma, cleanup } = await createTestPrisma()

  try {
    const project = await prisma.project.findFirstOrThrow({ where: { projectKey: 'default' } })
    const [code] = await generateActivationCodes(prisma, {
      projectKey: 'default',
      amount: 1,
      licenseMode: 'COUNT',
      totalCount: 5,
    })

    const product = await prisma.shopProduct.create({
      data: {
        name: '悬空库存回归卡',
        projectId: project.id,
        licenseMode: 'COUNT',
        cardType: '次卡',
        totalCount: 5,
        priceInCents: 500,
        isEnabled: true,
        stockMode: 'PREDEFINED',
      },
    })

    // 悬空库存排在前面（id 升序先取到它）：修复前每一单都会撞上并抛错
    await prisma.shopProductCodeStock.create({
      data: { productId: product.id, activationCodeId: NON_EXISTENT_CODE_ID, status: 'AVAILABLE' },
    })
    await prisma.shopProductCodeStock.create({
      data: { productId: product.id, activationCodeId: code.id, status: 'AVAILABLE' },
    })

    await prisma.shopOrder.create({
      data: {
        orderNo: 'SO-DANGLING-001',
        productId: product.id,
        quantity: 1,
        amountInCents: 500,
        contactEmail: 'buyer@test.com',
        status: 'paid',
        provider: 'manual',
      },
    })

    const result = await fulfillShopOrder(
      { orderNo: 'SO-DANGLING-001', adminUsername: 'admin' },
      undefined,
      prisma,
    )

    assert.equal(result.success, true)
    assert.deepEqual(result.codes, [code.code])

    // 悬空库存行被顺带清理
    const danglingLeft = await prisma.shopProductCodeStock.count({
      where: { activationCodeId: NON_EXISTENT_CODE_ID },
    })
    assert.equal(danglingLeft, 0)

    // 有效库存被正常抢占
    const claimedStock = await prisma.shopProductCodeStock.findFirstOrThrow({
      where: { activationCodeId: code.id },
    })
    assert.equal(claimedStock.status, 'SOLD')
    assert.equal(claimedStock.soldOrderId, 1)

    const order = await prisma.shopOrder.findUniqueOrThrow({ where: { orderNo: 'SO-DANGLING-001' } })
    assert.equal(order.status, 'fulfilled')
  } finally {
    await prisma.$disconnect()
    cleanup()
  }
})

test('码池全部悬空时按售罄处理，订单回到原状态', async () => {
  const { prisma, cleanup } = await createTestPrisma()

  try {
    const project = await prisma.project.findFirstOrThrow({ where: { projectKey: 'default' } })
    const product = await prisma.shopProduct.create({
      data: {
        name: '全悬空回归卡',
        projectId: project.id,
        licenseMode: 'TIME',
        cardType: '时间卡',
        validDays: 30,
        priceInCents: 990,
        isEnabled: true,
        stockMode: 'PREDEFINED',
      },
    })

    await prisma.shopProductCodeStock.create({
      data: { productId: product.id, activationCodeId: NON_EXISTENT_CODE_ID, status: 'AVAILABLE' },
    })

    await prisma.shopOrder.create({
      data: {
        orderNo: 'SO-DANGLING-002',
        productId: product.id,
        quantity: 1,
        amountInCents: 990,
        contactEmail: null,
        status: 'paid',
        provider: 'manual',
      },
    })

    const result = await fulfillShopOrder(
      { orderNo: 'SO-DANGLING-002', adminUsername: 'admin' },
      undefined,
      prisma,
    )

    assert.equal(result.success, false)
    assert.match(result.message ?? '', /售罄/)

    const order = await prisma.shopOrder.findUniqueOrThrow({ where: { orderNo: 'SO-DANGLING-002' } })
    assert.equal(order.status, 'paid')
  } finally {
    await prisma.$disconnect()
    cleanup()
  }
})

test('关闭设备绑定时 COUNT 码可二次激活（同机）', async () => {
  const { prisma, cleanup } = await createTestPrisma()

  try {
    const [code] = await generateActivationCodes(prisma, {
      projectKey: 'default',
      amount: 1,
      licenseMode: 'COUNT',
      totalCount: 5,
    })

    // 模拟「关闭设备绑定时的首次激活」：isUsed=true 但 usedBy=null
    await prisma.activationCode.update({
      where: { id: code.id },
      data: { isUsed: true, usedAt: new Date(), usedBy: null, lastBoundAt: null },
    })

    const persisted = await prisma.activationCode.findUniqueOrThrow({ where: { id: code.id } })

    const noBindResult = await activateCountLicense({
      tx: prisma,
      activationCode: persisted,
      machineId: 'machine-A',
      bindDevice: false,
    })
    assert.equal(noBindResult.success, true)

    // 换台设备再次激活（绑定仍关闭）：不误报「已被其他设备使用」
    const persisted2 = await prisma.activationCode.findUniqueOrThrow({ where: { id: code.id } })
    const secondResult = await activateCountLicense({
      tx: prisma,
      activationCode: persisted2,
      machineId: 'machine-B',
      bindDevice: false,
    })
    assert.equal(secondResult.success, true)
    assert.doesNotMatch(secondResult.message ?? '', /其他设备/)

    // 绑定开启但历史无绑定：补绑当前设备成功
    await prisma.activationCode.update({
      where: { id: code.id },
      data: { usedBy: null, lastBoundAt: null },
    })
    const persisted4 = await prisma.activationCode.findUniqueOrThrow({ where: { id: code.id } })
    const bindResult = await activateCountLicense({
      tx: prisma,
      activationCode: persisted4,
      machineId: 'machine-C',
      bindDevice: true,
    })
    assert.equal(bindResult.success, true)
    const bound = await prisma.activationCode.findUniqueOrThrow({ where: { id: code.id } })
    assert.equal(bound.usedBy, 'machine-C')
  } finally {
    await prisma.$disconnect()
    cleanup()
  }
})
