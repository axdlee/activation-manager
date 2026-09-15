import assert from 'node:assert/strict'
import test from 'node:test'

import { prisma } from '../src/lib/db'
import { bootstrapDevelopmentDatabase } from '../src/lib/dev-bootstrap'
import { scanExpiredActivationCodes } from '../src/lib/license-expiry-scan-service'
import { resetExpiryNotificationDeduplication } from '../src/lib/license-expiry-notification-service'

const silentLogger = { log: () => undefined, error: () => undefined }

test.before(async () => {
  await bootstrapDevelopmentDatabase({ logger: silentLogger })
})

test.after(async () => {
  await prisma.$disconnect()
})

test.beforeEach(() => {
  resetExpiryNotificationDeduplication()
})

test.afterEach(async () => {
  await prisma.activationCode.deleteMany({
    where: { projectId: { not: undefined } },
  })
})

test('scanExpiredActivationCodes 扫描到过期 TIME 码并触发通知', async () => {
  const project = await prisma.project.findFirstOrThrow({ where: { projectKey: 'default' } })

  // 已过期的 TIME 码
  await prisma.activationCode.create({
    data: {
      code: 'EXPIRED-SCAN-001',
      projectId: project.id,
      licenseMode: 'TIME',
      isUsed: true,
      usedBy: 'machine-scan',
      usedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      validDays: 30,
    },
  })

  // 未过期的 TIME 码
  await prisma.activationCode.create({
    data: {
      code: 'VALID-SCAN-001',
      projectId: project.id,
      licenseMode: 'TIME',
      isUsed: true,
      usedBy: 'machine-scan2',
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      validDays: 30,
    },
  })

  const result = await scanExpiredActivationCodes()

  assert.equal(result.scanned, 1) // 只有过期码被扫描到
  assert.equal(result.notified, 1) // 触发通知（去重后首次）
})

test('scanExpiredActivationCodes 扫描到耗尽 COUNT 码', async () => {
  const project = await prisma.project.findFirstOrThrow({ where: { projectKey: 'default' } })

  await prisma.activationCode.create({
    data: {
      code: 'DEPLETED-SCAN-001',
      projectId: project.id,
      licenseMode: 'COUNT',
      totalCount: 5,
      remainingCount: 0,
      isUsed: true,
      usedBy: 'machine-depleted',
    },
  })

  const result = await scanExpiredActivationCodes()

  assert.equal(result.scanned, 1)
  assert.equal(result.notified, 1)
})

test('scanExpiredActivationCodes 重复扫描不重复通知（去重）', async () => {
  const project = await prisma.project.findFirstOrThrow({ where: { projectKey: 'default' } })

  await prisma.activationCode.create({
    data: {
      code: 'DUP-SCAN-001',
      projectId: project.id,
      licenseMode: 'TIME',
      isUsed: true,
      usedBy: 'machine-dup',
      usedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      validDays: 30,
    },
  })

  const first = await scanExpiredActivationCodes()
  const second = await scanExpiredActivationCodes()

  assert.equal(first.notified, 1)
  assert.equal(second.notified, 0) // 第二次去重，不再通知
})
