import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { PrismaClient } from '@prisma/client'

import { bootstrapDevelopmentDatabase } from '../src/lib/dev-bootstrap'
import {
  forceRebindActivationCode,
  forceUnbindActivationCode,
  updateActivationCodeRebindSettings,
} from '../src/lib/license-code-admin-service'
import { generateActivationCodes } from '../src/lib/license-generation-service'
import { createProject } from '../src/lib/license-project-service'

const silentLogger = { log: () => undefined, error: () => undefined }

async function createTestPrisma() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'activation-manager-code-admin-'))
  const dbPath = path.join(tempDir, 'dev.db')

  await bootstrapDevelopmentDatabase({ dbPath, logger: silentLogger })

  const prisma = new PrismaClient({
    datasources: { db: { url: `file:${dbPath}` } },
  })

  return { prisma }
}

test('license-code-admin-service 支持更新单码换绑策略、强制解绑与强制换绑', async () => {
  const { prisma } = await createTestPrisma()

  try {
    await createProject(prisma, {
      name: '浏览器插件',
      projectKey: 'browser-plugin',
      allowAutoRebind: true,
      autoRebindCooldownMinutes: 180,
      autoRebindMaxCount: 2,
    })

    const [code] = await generateActivationCodes(prisma, {
      projectKey: 'browser-plugin',
      amount: 1,
      licenseMode: 'COUNT',
      totalCount: 5,
    })

    await prisma.activationCode.update({
      where: { id: code.id },
      data: {
        isUsed: true,
        usedAt: new Date('2026-03-26T00:00:00.000Z'),
        usedBy: 'machine-old',
      },
    })

    const updatedPolicy = await updateActivationCodeRebindSettings(prisma, {
      id: code.id,
      allowAutoRebind: false,
      autoRebindCooldownMinutes: 60,
      autoRebindMaxCount: 1,
      adminUsername: 'admin',
      reason: '针对投诉收紧自助换绑策略',
    })

    assert.equal(updatedPolicy.allowAutoRebind, false)
    assert.equal(updatedPolicy.autoRebindCooldownMinutes, 60)
    assert.equal(updatedPolicy.autoRebindMaxCount, 1)

    const unbound = await forceUnbindActivationCode(prisma, {
      id: code.id,
      adminUsername: 'admin',
      reason: '人工解绑排障',
    })
    assert.equal(unbound.usedBy, null)

    const rebound = await forceRebindActivationCode(prisma, {
      id: code.id,
      machineId: 'machine-new',
      adminUsername: 'admin',
      reason: '人工切换到新设备',
    })

    assert.equal(rebound.usedBy, 'machine-new')
    assert.ok(rebound.lastBoundAt instanceof Date)
    assert.ok(rebound.usedAt instanceof Date)
    assert.equal(rebound.rebindCount, 0)
    assert.equal(rebound.autoRebindCount, 0)

    const bindingHistory = await prisma.activationCodeBindingHistory.findMany({
      where: {
        activationCodeId: code.id,
      },
      orderBy: {
        id: 'asc',
      },
    })
    const adminLogs = await prisma.adminOperationAuditLog.findMany({
      where: {
        activationCodeId: code.id,
      },
      orderBy: {
        id: 'asc',
      },
    })

    assert.deepEqual(
      bindingHistory.map((entry) => ({
        eventType: entry.eventType,
        fromMachineId: entry.fromMachineId,
        toMachineId: entry.toMachineId,
        operatorType: entry.operatorType,
      })),
      [
        {
          eventType: 'FORCE_UNBIND',
          fromMachineId: 'machine-old',
          toMachineId: null,
          operatorType: 'ADMIN',
        },
        {
          eventType: 'FORCE_REBIND',
          fromMachineId: null,
          toMachineId: 'machine-new',
          operatorType: 'ADMIN',
        },
      ],
    )
    assert.deepEqual(
      adminLogs.map((entry) => entry.operationType),
      [
        'CODE_REBIND_SETTINGS_UPDATED',
        'CODE_FORCE_UNBIND',
        'CODE_FORCE_REBIND',
      ],
    )
    assert.equal(adminLogs[0]?.reason, '针对投诉收紧自助换绑策略')
  } finally {
    await prisma.$disconnect()
  }
})
