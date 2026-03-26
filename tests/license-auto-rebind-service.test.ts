import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveMutableLicenseActionCodeForMachine } from '../src/lib/license-auto-rebind-service'

test('resolveMutableLicenseActionCodeForMachine 在自动换绑被禁止时返回占用结果', async () => {
  const result = await resolveMutableLicenseActionCodeForMachine({
    tx: {
      activationCode: {
        update: async () => {
          throw new Error('should not update')
        },
      },
    } as never,
    activationCode: {
      id: 1,
      projectId: 1,
      code: 'CODE-001',
      licenseMode: 'COUNT',
      totalCount: 10,
      remainingCount: 8,
      consumedCount: 2,
      isUsed: true,
      usedAt: new Date('2026-03-26T00:00:00.000Z'),
      usedBy: 'machine-old',
      allowAutoRebind: false,
      autoRebindCooldownMinutes: null,
      autoRebindMaxCount: null,
      autoRebindCount: 0,
      project: {
        id: 1,
        name: '测试项目',
        projectKey: 'demo',
        allowAutoRebind: true,
        autoRebindCooldownMinutes: 120,
        autoRebindMaxCount: 2,
      },
    },
    machineId: 'machine-new',
    reloadActivationCode: async () => null,
    resolveProjectMachineConflict: async () => ({ success: false, message: 'conflict', status: 409 }),
  })

  assert.deepEqual(result, {
    result: {
      success: false,
      message: '激活码已被其他设备使用',
      status: 400,
    },
  })
})

test('resolveMutableLicenseActionCodeForMachine 在冷却期内返回可换绑时间', async () => {
  const result = await resolveMutableLicenseActionCodeForMachine({
    tx: {
      activationCode: {
        update: async () => {
          throw new Error('should not update')
        },
      },
    } as never,
    activationCode: {
      id: 1,
      projectId: 1,
      code: 'CODE-001',
      licenseMode: 'TIME',
      isUsed: true,
      validDays: 30,
      usedAt: new Date('2026-03-26T00:00:00.000Z'),
      expiresAt: new Date('2026-04-25T00:00:00.000Z'),
      usedBy: 'machine-old',
      lastBoundAt: new Date('2026-03-26T00:00:00.000Z'),
      allowAutoRebind: true,
      autoRebindCooldownMinutes: 60,
      autoRebindMaxCount: 3,
      autoRebindCount: 1,
      project: {
        id: 1,
        name: '测试项目',
        projectKey: 'demo',
        allowAutoRebind: false,
        autoRebindCooldownMinutes: 999,
        autoRebindMaxCount: 0,
      },
    },
    machineId: 'machine-new',
    reloadActivationCode: async () => null,
    resolveProjectMachineConflict: async () => ({ success: false, message: 'conflict', status: 409 }),
    now: new Date('2026-03-26T00:30:00.000Z'),
  })

  assert.ok('result' in result)
  assert.equal(result.result.status, 409)
  assert.equal(result.result.rebindAllowedAt?.toISOString(), '2026-03-26T01:00:00.000Z')
  assert.match(result.result.message, /换绑冷却期/)
})

test('resolveMutableLicenseActionCodeForMachine 在达到自助换绑次数上限时返回受限结果', async () => {
  const result = await resolveMutableLicenseActionCodeForMachine({
    tx: {
      activationCode: {
        update: async () => {
          throw new Error('should not update')
        },
      },
    } as never,
    activationCode: {
      id: 1,
      projectId: 1,
      code: 'CODE-001',
      licenseMode: 'TIME',
      isUsed: true,
      validDays: 30,
      usedAt: new Date('2026-03-26T00:00:00.000Z'),
      expiresAt: new Date('2026-04-25T00:00:00.000Z'),
      usedBy: 'machine-old',
      lastBoundAt: new Date('2026-03-26T00:00:00.000Z'),
      allowAutoRebind: true,
      autoRebindCooldownMinutes: 0,
      autoRebindMaxCount: 1,
      autoRebindCount: 1,
      project: {
        id: 1,
        name: '测试项目',
        projectKey: 'demo',
        allowAutoRebind: true,
        autoRebindCooldownMinutes: 0,
        autoRebindMaxCount: 0,
      },
    },
    machineId: 'machine-new',
    reloadActivationCode: async () => null,
    resolveProjectMachineConflict: async () => ({ success: false, message: 'conflict', status: 409 }),
    now: new Date('2026-03-26T02:00:00.000Z'),
  })

  assert.ok('result' in result)
  assert.equal(result.result.status, 409)
  assert.match(result.result.message, /自助换绑次数上限/)
})
