import assert from 'node:assert/strict'
import test from 'node:test'

import {
  activateCountLicense,
  activateTimeLicense,
} from '../src/lib/license-activation-flow-service'

function countMock(returnCount: number) {
  return async () => ({ count: returnCount })
}

test('activateCountLicense 会在次数已耗尽时直接返回失败且不写库', async () => {
  let updateCalled = false

  const result = await activateCountLicense({
    tx: {
      activationCode: {
        code: 'TEST-CODE',
        projectId: 1,
        updateMany: async () => {
          updateCalled = true
          throw new Error('should not update')
        },
      },
    } as never,
    activationCode: {
      code: 'TEST-CODE',
      projectId: 1,
      id: 1,
      licenseMode: 'COUNT',
      totalCount: 3,
      remainingCount: 0,
      isUsed: false,
      usedAt: null,
      expiresAt: null,
      validDays: null,
    },
    machineId: 'machine-001',
    resolveProjectMachineConflict: async () => ({
      success: false,
      message: 'unexpected',
      status: 409,
    }),
  })

  assert.equal(updateCalled, false)
  assert.deepEqual(result, {
    success: false,
    message: '激活码可用次数已用完',
    status: 400,
  })
})

test('activateCountLicense 在首次绑定成功时会写入设备并保留已有 usedAt', async () => {
  const updatePayloads: Array<Record<string, unknown>> = []

  const existingUsedAt = new Date('2026-03-25T00:00:00.000Z')
  const result = await activateCountLicense({
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
      code: 'TEST-CODE',
      projectId: 1,
      id: 1,
      licenseMode: 'COUNT',
      totalCount: 3,
      remainingCount: 2,
      isUsed: false,
      usedAt: existingUsedAt,
      expiresAt: null,
      validDays: null,
    },
    machineId: 'machine-001',
    resolveProjectMachineConflict: async () => ({
      success: false,
      message: 'unexpected',
      status: 409,
    }),
  })

  assert.equal(updatePayloads.length, 1)
  assert.equal(updatePayloads[0]?.usedAt, existingUsedAt)
  assert.equal(updatePayloads[0]?.usedBy, 'machine-001')
  assert.equal(updatePayloads[0]?.lastBoundAt instanceof Date, true)
  assert.deepEqual(result, {
    success: true,
    message: '激活码激活成功',
    status: 200,
    licenseMode: 'COUNT',
    expiresAt: null,
    remainingCount: 2,
    isActivated: true,
    valid: true,
  })
})

test('activateCountLicense 并发竞态下 count=0 时返回已被其他设备使用', async () => {
  const result = await activateCountLicense({
    tx: {
      activationCode: {
        code: 'TEST-CODE',
        projectId: 1,
        updateMany: countMock(0),
      },
    } as never,
    activationCode: {
      code: 'TEST-CODE',
      projectId: 1,
      id: 1,
      licenseMode: 'COUNT',
      totalCount: 3,
      remainingCount: 2,
      isUsed: false,
      usedAt: null,
      expiresAt: null,
      validDays: null,
    },
    machineId: 'machine-001',
    resolveProjectMachineConflict: async () => ({
      success: false,
      message: 'unexpected',
      status: 409,
    }),
  })

  assert.deepEqual(result, {
    success: false,
    message: '激活码已被其他设备使用',
    status: 400,
  })
})

test('activateTimeLicense 在唯一约束冲突时会调用冲突收敛器', async () => {
  let conflictResolved = false

  const result = await activateTimeLicense({
    tx: {
      activationCode: {
        projectId: 1,
        updateMany: async () => {
          throw {
            code: 'P2002',
            meta: {
              target: ['projectId', 'usedBy'],
            },
          }
        },
      },
    } as never,
    activationCode: {
      code: 'TEST-CODE',
      projectId: 1,
      id: 2,
      licenseMode: 'TIME',
      isUsed: false,
      usedBy: null,
      usedAt: null,
      expiresAt: null,
      validDays: 30,
      remainingCount: null,
    },
    machineId: 'machine-001',
    resolveProjectMachineConflict: async () => {
      conflictResolved = true
      return {
        success: false,
        message: '同一项目下每台设备只能使用一个有效激活码',
        status: 409,
      }
    },
  })

  assert.equal(conflictResolved, true)
  assert.deepEqual(result, {
    success: false,
    message: '同一项目下每台设备只能使用一个有效激活码',
    status: 409,
  })
})

test('activateTimeLicense 首次激活会写入 expiresAt 并返回激活成功', async () => {
  const updatePayloads: Array<Record<string, unknown>> = []

  const result = await activateTimeLicense({
    tx: {
      activationCode: {
        projectId: 1,
        updateMany: async ({ data }: { data: Record<string, unknown> }) => {
          updatePayloads.push(data)
          return { count: 1 }
        },
      },
    } as never,
    activationCode: {
      code: 'TIME-CODE',
      projectId: 1,
      id: 3,
      licenseMode: 'TIME',
      isUsed: false,
      usedBy: null,
      usedAt: null,
      expiresAt: null,
      validDays: 30,
      remainingCount: null,
    },
    machineId: 'machine-002',
    resolveProjectMachineConflict: async () => ({
      success: false,
      message: 'unexpected',
      status: 409,
    }),
  })

  assert.equal(updatePayloads.length, 1)
  assert.equal(updatePayloads[0]?.usedBy, 'machine-002')
  assert.equal(updatePayloads[0]?.isUsed, true)
  assert.ok(updatePayloads[0]?.expiresAt instanceof Date)
  assert.equal(result.success, true)
  assert.equal(result.message, '激活码激活成功')
})

test('activateTimeLicense 并发竞态下 count=0 时返回已被其他设备使用', async () => {
  const result = await activateTimeLicense({
    tx: {
      activationCode: {
        projectId: 1,
        updateMany: countMock(0),
      },
    } as never,
    activationCode: {
      code: 'TIME-CODE',
      projectId: 1,
      id: 3,
      licenseMode: 'TIME',
      isUsed: false,
      usedBy: null,
      usedAt: null,
      expiresAt: null,
      validDays: 30,
      remainingCount: null,
    },
    machineId: 'machine-002',
    resolveProjectMachineConflict: async () => ({
      success: false,
      message: 'unexpected',
      status: 409,
    }),
  })

  assert.deepEqual(result, {
    success: false,
    message: '激活码已被其他设备使用',
    status: 400,
  })
})
