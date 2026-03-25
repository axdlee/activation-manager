import assert from 'node:assert/strict'
import test from 'node:test'

import { createLicenseTransactionHelpers } from '../src/lib/license-transaction-helpers'

test('createLicenseTransactionHelpers.resolveProjectMachineConflict 会在存在旧绑定时返回稳定冲突结果', async () => {
  const helpers = createLicenseTransactionHelpers(
    {
      activationCode: {
        findFirst: async () => ({
          code: 'OLD-CODE-001',
          licenseMode: 'COUNT',
          remainingCount: 2,
          isUsed: true,
          usedAt: new Date('2026-03-25T00:00:00.000Z'),
          expiresAt: null,
          validDays: null,
        }),
      },
      licenseConsumption: {
        delete: async () => undefined,
        update: async () => undefined,
      },
    } as never,
    {
      projectId: 1,
      code: 'TARGET-CODE-001',
      machineId: 'machine-001',
    },
  )

  const result = await helpers.resolveProjectMachineConflict()

  assert.deepEqual(result, {
    success: false,
    message: '该设备已绑定激活码: OLD-CODE-001，请先用完剩余次数（剩余 2 次）',
    status: 400,
  })
})

test('createLicenseTransactionHelpers.resolveProjectMachineConflict 在查不到旧绑定时返回默认 409 结果', async () => {
  const helpers = createLicenseTransactionHelpers(
    {
      activationCode: {
        findFirst: async () => null,
      },
      licenseConsumption: {
        delete: async () => undefined,
        update: async () => undefined,
      },
    } as never,
    {
      projectId: 1,
      code: 'TARGET-CODE-001',
      machineId: 'machine-001',
    },
  )

  const result = await helpers.resolveProjectMachineConflict()

  assert.deepEqual(result, {
    success: false,
    message: '同一项目下每台设备只能使用一个有效激活码',
    status: 409,
  })
})

test('createLicenseTransactionHelpers.reloadActivationCode 会按 projectId 和 code 重载当前激活码', async () => {
  const helpers = createLicenseTransactionHelpers(
    {
      activationCode: {
        findUnique: async () => ({
          id: 11,
          code: 'TARGET-CODE-001',
          projectId: 1,
          licenseMode: 'COUNT',
          isUsed: true,
          usedBy: 'machine-001',
          usedAt: new Date('2026-03-25T00:00:00.000Z'),
          expiresAt: null,
          validDays: null,
          remainingCount: 1,
          project: {
            id: 1,
            name: '项目A',
            projectKey: 'project-a',
          },
        }),
      },
      licenseConsumption: {
        delete: async () => undefined,
        update: async () => undefined,
      },
    } as never,
    {
      projectId: 1,
      code: 'TARGET-CODE-001',
      machineId: 'machine-001',
    },
  )

  const code = await helpers.reloadActivationCode()
  assert.equal(code?.code, 'TARGET-CODE-001')
  assert.equal(code?.projectId, 1)
})

test('createLicenseTransactionHelpers 会提供 requestId 回滚与结算 helper', async () => {
  const deleteCalls: string[] = []
  const updateCalls: Array<{ requestId: string, remainingCountAfter: number }> = []

  const helpers = createLicenseTransactionHelpers(
    {
      activationCode: {
        findFirst: async () => null,
        findUnique: async () => null,
      },
      licenseConsumption: {
        delete: async ({ where }: { where: { requestId: string } }) => {
          deleteCalls.push(where.requestId)
        },
        update: async ({ where, data }: { where: { requestId: string }, data: { remainingCountAfter: number } }) => {
          updateCalls.push({
            requestId: where.requestId,
            remainingCountAfter: data.remainingCountAfter,
          })
        },
      },
    } as never,
    {
      projectId: 1,
      code: 'TARGET-CODE-001',
      machineId: 'machine-001',
    },
  )

  await helpers.rollbackClaimedRequestId('req-001')
  await helpers.persistConsumptionRemainingCount('req-001', 3)

  assert.deepEqual(deleteCalls, ['req-001'])
  assert.deepEqual(updateCalls, [{
    requestId: 'req-001',
    remainingCountAfter: 3,
  }])
})
