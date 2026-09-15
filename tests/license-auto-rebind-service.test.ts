import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveMutableLicenseActionCodeForMachine } from '../src/lib/license-auto-rebind-service'

test('resolveMutableLicenseActionCodeForMachine 在自动换绑被禁止时返回占用结果', async () => {
  const result = await resolveMutableLicenseActionCodeForMachine({
    tx: {
      activationCode: {
        code: 'TEST-CODE',
        projectId: 1,
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
      isUsed: true,
      usedAt: new Date('2026-03-26T00:00:00.000Z'),
      usedBy: 'machine-old',
      expiresAt: null,
      validDays: null,
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
        code: 'TEST-CODE',
        projectId: 1,
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
      usedAt: new Date('2026-03-26T00:00:00.000Z'),
      usedBy: 'machine-old',
      expiresAt: new Date('2026-04-25T00:00:00.000Z'),
      validDays: 30,
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

  assert.ok('result' in result && result.result)
  assert.equal(result.result.status, 409)
  assert.equal(result.result.rebindAllowedAt?.toISOString(), '2026-03-26T01:00:00.000Z')
  assert.match(result.result.message, /换绑冷却期/)
})

test('resolveMutableLicenseActionCodeForMachine 在达到自助换绑次数上限时返回受限结果', async () => {
  const result = await resolveMutableLicenseActionCodeForMachine({
    tx: {
      activationCode: {
        code: 'TEST-CODE',
        projectId: 1,
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
      usedAt: new Date('2026-03-26T00:00:00.000Z'),
      usedBy: 'machine-old',
      expiresAt: new Date('2026-04-25T00:00:00.000Z'),
      validDays: 30,
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

  assert.ok('result' in result && result.result)
  assert.equal(result.result.status, 409)
  assert.match(result.result.message, /自助换绑次数上限/)
})
test('resolveMutableLicenseActionCodeForMachine 在换绑成功后返回最新激活码', async () => {
  const updatePayloads: Array<Record<string, unknown>> = []
  const reboundCode = {
    id: 1,
    projectId: 1,
    code: 'CODE-001',
    licenseMode: 'TIME' as const,
    isUsed: true,
    usedAt: new Date('2026-03-26T00:00:00.000Z'),
    usedBy: 'machine-new',
    expiresAt: new Date('2026-04-25T00:00:00.000Z'),
    validDays: 30,
    lastBoundAt: new Date('2026-03-26T02:00:00.000Z'),
    lastRebindAt: new Date('2026-03-26T02:00:00.000Z'),
    allowAutoRebind: true,
    autoRebindCooldownMinutes: 0,
    autoRebindMaxCount: 3,
    autoRebindCount: 2,
    project: {
      id: 1,
      name: '测试项目',
      projectKey: 'demo',
      allowAutoRebind: true,
      autoRebindCooldownMinutes: 0,
      autoRebindMaxCount: 0,
    },
  }

  const result = await resolveMutableLicenseActionCodeForMachine({
    tx: {
      activationCode: {
        code: 'TEST-CODE',
        projectId: 1,
        updateMany: async ({ data }: { data: Record<string, unknown> }) => {
          updatePayloads.push(data)
          return { count: 1 }
        },
      },
    } as never,
    activationCode: {
      id: 1,
      projectId: 1,
      code: 'CODE-001',
      licenseMode: 'TIME',
      isUsed: true,
      usedAt: new Date('2026-03-26T00:00:00.000Z'),
      usedBy: 'machine-old',
      expiresAt: new Date('2026-04-25T00:00:00.000Z'),
      validDays: 30,
      lastBoundAt: new Date('2026-03-26T00:00:00.000Z'),
      lastRebindAt: new Date('2026-03-26T01:00:00.000Z'),
      allowAutoRebind: true,
      autoRebindCooldownMinutes: 0,
      autoRebindMaxCount: 3,
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
    reloadActivationCode: async () => reboundCode,
    resolveProjectMachineConflict: async () => ({ success: false, message: 'conflict', status: 409 }),
    now: new Date('2026-03-26T02:00:00.000Z'),
  })

  assert.equal(updatePayloads.length, 1)
  assert.equal(updatePayloads[0]?.usedBy, 'machine-new')
  assert.ok(updatePayloads[0]?.rebindCount)
  assert.ok(updatePayloads[0]?.autoRebindCount)
  assert.equal('activationCode' in result ? result.activationCode?.usedBy : null, 'machine-new')
})

test('resolveMutableLicenseActionCodeForMachine 并发换绑 count=0 时重新加载判定', async () => {
  const concurrentCode = {
    id: 1,
    projectId: 1,
    code: 'CODE-001',
    licenseMode: 'TIME' as const,
    isUsed: true,
    usedAt: new Date('2026-03-26T00:00:00.000Z'),
    usedBy: 'machine-other',
    expiresAt: new Date('2026-04-25T00:00:00.000Z'),
    validDays: 30,
    lastBoundAt: new Date('2026-03-26T02:00:00.000Z'),
    lastRebindAt: new Date('2026-03-26T02:00:00.000Z'),
    allowAutoRebind: true,
    autoRebindCooldownMinutes: 0,
    autoRebindMaxCount: 3,
    autoRebindCount: 2,
    project: {
      id: 1,
      name: '测试项目',
      projectKey: 'demo',
      allowAutoRebind: true,
      autoRebindCooldownMinutes: 0,
      autoRebindMaxCount: 0,
    },
  }

  const result = await resolveMutableLicenseActionCodeForMachine({
    tx: {
      activationCode: {
        code: 'TEST-CODE',
        projectId: 1,
        updateMany: async () => ({ count: 0 }),
      },
    } as never,
    activationCode: {
      id: 1,
      projectId: 1,
      code: 'CODE-001',
      licenseMode: 'TIME',
      isUsed: true,
      usedAt: new Date('2026-03-26T00:00:00.000Z'),
      usedBy: 'machine-old',
      expiresAt: new Date('2026-04-25T00:00:00.000Z'),
      validDays: 30,
      lastBoundAt: new Date('2026-03-26T00:00:00.000Z'),
      lastRebindAt: new Date('2026-03-26T01:00:00.000Z'),
      allowAutoRebind: true,
      autoRebindCooldownMinutes: 0,
      autoRebindMaxCount: 3,
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
    reloadActivationCode: async () => concurrentCode,
    resolveProjectMachineConflict: async () => ({ success: false, message: 'conflict', status: 409 }),
    now: new Date('2026-03-26T02:00:00.000Z'),
  })

  // 并发下最新记录已绑定其他设备 → 返回占用结果
  assert.ok('result' in result && result.result)
  assert.equal(result.result.status, 400)
  assert.match(result.result.message, /已被其他设备使用/)
})
