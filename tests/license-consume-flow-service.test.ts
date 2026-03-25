import assert from 'node:assert/strict'
import test from 'node:test'

import {
  consumeCountLicense,
  consumeTimeLicense,
} from '../src/lib/license-consume-flow-service'

test('consumeTimeLicense 在首次验证成功时会写入激活信息并返回成功结果', async () => {
  const updatePayloads: Array<Record<string, unknown>> = []
  const updatedCode = {
    id: 1,
    licenseMode: 'TIME',
    isUsed: true,
    usedBy: 'machine-001',
    usedAt: new Date('2026-03-25T00:00:00.000Z'),
    expiresAt: null,
    validDays: 30,
    remainingCount: null,
  }

  const result = await consumeTimeLicense({
    tx: {
      activationCode: {
        updateMany: async ({ data }: { data: Record<string, unknown> }) => {
          updatePayloads.push(data)
          return { count: 1 }
        },
      },
    } as never,
    activationCode: {
      id: 1,
      licenseMode: 'TIME',
      isUsed: false,
      usedBy: null,
      usedAt: null,
      expiresAt: null,
      validDays: 30,
      remainingCount: null,
    },
    projectId: 1,
    code: 'TIME-CODE-001',
    machineId: 'machine-001',
    reloadActivationCode: async () => updatedCode,
    resolveProjectMachineConflict: async () => ({
      success: false,
      message: 'unexpected',
      status: 409,
    }),
  })

  assert.equal(updatePayloads.length, 1)
  assert.equal(updatePayloads[0]?.usedBy, 'machine-001')
  assert.deepEqual(result, {
    success: true,
    message: '激活码验证成功',
    status: 200,
    licenseMode: 'TIME',
    expiresAt: new Date('2026-04-24T00:00:00.000Z'),
    isActivated: true,
    valid: true,
  })
})

test('consumeCountLicense 在成功扣次后会结算 requestId 并返回次数型结果', async () => {
  const persistedSettlements: Array<{ requestId: string, remainingCountAfter: number }> = []
  const usedAtUpdates: Array<Record<string, unknown>> = []

  const result = await consumeCountLicense({
    tx: {
      activationCode: {
        updateMany: async ({ data }: { data: Record<string, unknown> }) => {
          if ('remainingCount' in data) {
            return { count: 1 }
          }

          usedAtUpdates.push(data)
          return { count: 1 }
        },
      },
    } as never,
    activationCode: {
      id: 1,
      licenseMode: 'COUNT',
      totalCount: 3,
      remainingCount: 2,
      isUsed: false,
      usedBy: null,
      usedAt: null,
      expiresAt: null,
      validDays: null,
    },
    projectId: 1,
    code: 'COUNT-CODE-001',
    machineId: 'machine-001',
    requestId: 'req-001',
    claimRequestId: async () => ({
      claimed: true,
      existingResult: null,
    }),
    rollbackClaimedRequestId: async () => undefined,
    reloadActivationCode: async () => ({
      id: 1,
      licenseMode: 'COUNT',
      totalCount: 3,
      remainingCount: 1,
      isUsed: true,
      usedBy: 'machine-001',
      usedAt: new Date('2026-03-25T00:00:00.000Z'),
      expiresAt: null,
      validDays: null,
    }),
    persistConsumptionRemainingCount: async (requestId, remainingCountAfter) => {
      persistedSettlements.push({ requestId, remainingCountAfter })
    },
    resolveProjectMachineConflict: async () => ({
      success: false,
      message: 'unexpected',
      status: 409,
    }),
  })

  assert.equal(usedAtUpdates.length, 1)
  assert.deepEqual(persistedSettlements, [{
    requestId: 'req-001',
    remainingCountAfter: 1,
  }])
  assert.deepEqual(result, {
    success: true,
    message: '激活码验证成功',
    status: 200,
    licenseMode: 'COUNT',
    remainingCount: 1,
    isActivated: true,
    valid: true,
    idempotent: false,
  })
})

test('consumeCountLicense 在唯一约束冲突时会回滚已占位 requestId 并返回冲突结果', async () => {
  const rolledBackRequestIds: string[] = []

  const result = await consumeCountLicense({
    tx: {
      activationCode: {
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
      id: 1,
      licenseMode: 'COUNT',
      totalCount: 3,
      remainingCount: 2,
      isUsed: false,
      usedBy: null,
      usedAt: null,
      expiresAt: null,
      validDays: null,
    },
    projectId: 1,
    code: 'COUNT-CODE-001',
    machineId: 'machine-001',
    requestId: 'req-001',
    claimRequestId: async () => ({
      claimed: true,
      existingResult: null,
    }),
    rollbackClaimedRequestId: async (requestId) => {
      rolledBackRequestIds.push(requestId)
    },
    reloadActivationCode: async () => null,
    persistConsumptionRemainingCount: async () => undefined,
    resolveProjectMachineConflict: async () => ({
      success: false,
      message: '同一项目下每台设备只能使用一个有效激活码',
      status: 409,
    }),
  })

  assert.deepEqual(rolledBackRequestIds, ['req-001'])
  assert.deepEqual(result, {
    success: false,
    message: '同一项目下每台设备只能使用一个有效激活码',
    status: 409,
  })
})
