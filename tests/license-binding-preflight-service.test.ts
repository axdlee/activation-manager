import assert from 'node:assert/strict'
import test from 'node:test'

import { prepareMachineBindingForLicenseAction } from '../src/lib/license-binding-preflight-service'

test('prepareMachineBindingForLicenseAction 在未命中旧绑定时直接放行', async () => {
  let releaseCalled = false

  const result = await prepareMachineBindingForLicenseAction(
    {
      activationCode: {
        findFirst: async () => null,
        findMany: async () => {
          releaseCalled = true
          return []
        },
        updateMany: async () => {
          releaseCalled = true
          return { count: 0 }
        },
      },
    } as never,
    {
      projectId: 1,
      machineId: 'machine-001',
      targetCode: 'CODE-001',
    },
  )

  assert.equal(releaseCalled, false)
  assert.equal(result, null)
})

test('prepareMachineBindingForLicenseAction 在旧绑定不可复用时返回稳定冲突结果', async () => {
  const result = await prepareMachineBindingForLicenseAction(
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
      machineId: 'machine-001',
      targetCode: 'NEW-CODE-001',
    },
  )

  assert.deepEqual(result, {
    success: false,
    message: '该设备已绑定激活码: OLD-CODE-001，请先用完剩余次数（剩余 2 次）',
    status: 400,
  })
})

test('prepareMachineBindingForLicenseAction 在旧绑定可复用时会释放旧绑定并放行', async () => {
  const releasedBindings: number[][] = []

  const result = await prepareMachineBindingForLicenseAction(
    {
      activationCode: {
        findFirst: async () => ({
          id: 10,
          code: 'OLD-CODE-001',
          licenseMode: 'COUNT',
          totalCount: 5,
          remainingCount: 0,
          isUsed: true,
          usedAt: new Date('2026-03-25T00:00:00.000Z'),
          expiresAt: null,
          validDays: null,
        }),
        findMany: async () => ([
          {
            id: 10,
            code: 'OLD-CODE-001',
            licenseMode: 'COUNT',
            totalCount: 5,
            remainingCount: 0,
            isUsed: true,
            usedAt: new Date('2026-03-25T00:00:00.000Z'),
            expiresAt: null,
            validDays: null,
            usedBy: 'machine-001',
          },
        ]),
        updateMany: async ({ where }: { where: { id: { in: number[] } } }) => {
          releasedBindings.push(where.id.in)
          return { count: where.id.in.length }
        },
      },
    } as never,
    {
      projectId: 1,
      machineId: 'machine-001',
      targetCode: 'NEW-CODE-001',
    },
  )

  assert.equal(result, null)
  assert.deepEqual(releasedBindings, [[10]])
})
