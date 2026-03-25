import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveLicenseStatusForMachine } from '../src/lib/license-status-query-service'

test('resolveLicenseStatusForMachine 在激活码不存在时返回统一 not found 结果', async () => {
  const result = await resolveLicenseStatusForMachine(
    {
      activationCode: {
        findUnique: async () => null,
      },
    } as never,
    {
      projectId: 1,
      code: 'CODE-001',
      machineId: 'machine-001',
    },
  )

  assert.deepEqual(result, {
    success: false,
    message: '激活码不存在',
    status: 404,
  })
})

test('resolveLicenseStatusForMachine 在激活码被其他设备占用时返回统一冲突结果', async () => {
  const result = await resolveLicenseStatusForMachine(
    {
      activationCode: {
        findUnique: async () => ({
          id: 1,
          projectId: 1,
          code: 'CODE-001',
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
    } as never,
    {
      projectId: 1,
      code: 'CODE-001',
      machineId: 'machine-001',
    },
  )

  assert.deepEqual(result, {
    success: false,
    message: '激活码已被其他设备使用',
    status: 400,
  })
})

test('resolveLicenseStatusForMachine 在当前设备可用时返回统一状态结果', async () => {
  const result = await resolveLicenseStatusForMachine(
    {
      activationCode: {
        findUnique: async () => ({
          id: 1,
          projectId: 1,
          code: 'CODE-001',
          licenseMode: 'TIME',
          totalCount: null,
          remainingCount: null,
          consumedCount: 0,
          isUsed: false,
          usedAt: null,
          expiresAt: null,
          validDays: 30,
          usedBy: null,
          project: {
            id: 1,
            name: '测试项目',
            projectKey: 'demo-project',
          },
        }),
      },
    } as never,
    {
      projectId: 1,
      code: 'CODE-001',
      machineId: 'machine-001',
    },
  )

  assert.deepEqual(result, {
    success: true,
    message: '获取激活码状态成功',
    status: 200,
    licenseMode: 'TIME',
    expiresAt: null,
    remainingCount: null,
    isActivated: false,
    valid: true,
  })
})
