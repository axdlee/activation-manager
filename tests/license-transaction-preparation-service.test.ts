import assert from 'node:assert/strict'
import test from 'node:test'

import { prepareLicenseTransactionAction } from '../src/lib/license-transaction-preparation-service'

test('prepareLicenseTransactionAction 在旧绑定不可复用时直接返回稳定冲突结果', async () => {
  const result = await prepareLicenseTransactionAction(
    {
      activationCode: {
        findFirst: async () => ({
          id: 10,
          code: 'OLD-CODE-001',
          licenseMode: 'COUNT',
          totalCount: 5,
          remainingCount: 2,
          isUsed: true,
          usedAt: new Date('2026-03-25T00:00:00.000Z'),
          expiresAt: null,
          validDays: null,
        }),
      },
    } as never,
    {
      projectId: 1,
      code: 'NEW-CODE-001',
      machineId: 'machine-001',
    },
  )

  assert.deepEqual(result, {
    result: {
      success: false,
      message: '该设备已绑定激活码: OLD-CODE-001，请先用完剩余次数（剩余 2 次）',
      status: 400,
    },
  })
})

test('prepareLicenseTransactionAction 在目标激活码被其他设备占用时返回统一冲突结果', async () => {
  const result = await prepareLicenseTransactionAction(
    {
      activationCode: {
        findFirst: async () => null,
        findUnique: async () => ({
          id: 20,
          projectId: 1,
          code: 'TARGET-CODE-001',
          licenseMode: 'COUNT',
          totalCount: 5,
          remainingCount: 3,
          consumedCount: 2,
          isUsed: true,
          usedAt: new Date('2026-03-25T00:00:00.000Z'),
          expiresAt: null,
          validDays: null,
          usedBy: 'machine-999',
          project: {
            id: 1,
            name: '测试项目',
            projectKey: 'demo-project',
          },
        }),
      },
      licenseConsumption: {
        delete: async () => ({ id: 1 }),
        update: async () => ({ id: 1 }),
      },
    } as never,
    {
      projectId: 1,
      code: 'TARGET-CODE-001',
      machineId: 'machine-001',
    },
  )

  assert.deepEqual(result, {
    result: {
      success: false,
      message: '激活码已被其他设备使用',
      status: 400,
    },
  })
})

test('prepareLicenseTransactionAction 在前置通过时返回 activationCode 与 txHelpers', async () => {
  const activationCode = {
    id: 20,
    projectId: 1,
    code: 'TARGET-CODE-001',
    licenseMode: 'TIME',
    totalCount: null,
    remainingCount: null,
    consumedCount: 0,
    isUsed: true,
    usedAt: new Date('2026-03-25T00:00:00.000Z'),
    expiresAt: new Date('2026-03-26T00:00:00.000Z'),
    validDays: 1,
    usedBy: 'machine-001',
    project: {
      id: 1,
      name: '测试项目',
      projectKey: 'demo-project',
    },
  }

  let findUniqueCallCount = 0
  const client = {
    activationCode: {
      findFirst: async () => null,
      findUnique: async ({ where }: { where: { code: string } }) => {
        findUniqueCallCount += 1
        assert.equal(where.code, 'TARGET-CODE-001')
        return activationCode
      },
    },
    licenseConsumption: {
      delete: async () => ({ id: 1 }),
      update: async () => ({ id: 1 }),
    },
  } as never

  const result = await prepareLicenseTransactionAction(client, {
    projectId: 1,
    code: 'TARGET-CODE-001',
    machineId: 'machine-001',
  })

  assert.ok('activationCode' in result)
  assert.equal(result.activationCode, activationCode)
  assert.equal(typeof result.txHelpers.reloadActivationCode, 'function')

  const reloadedCode = await result.txHelpers.reloadActivationCode()
  assert.equal(reloadedCode, activationCode)
  assert.equal(findUniqueCallCount, 2)
})
