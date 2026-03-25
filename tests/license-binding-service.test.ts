import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildReusableConflictMessage,
  canReuseProjectBinding,
  findMachineBinding,
  findProjectActivationCode,
  isProjectMachineUniqueConstraintError,
  releaseReusableMachineBindings,
} from '../src/lib/license-binding-service'

type FakeProject = {
  id: number
  name: string
  projectKey: string
}

type FakeActivationCode = {
  id: number
  code: string
  projectId: number
  licenseMode: 'COUNT' | 'TIME'
  remainingCount: number | null
  totalCount?: number | null
  isUsed: boolean
  usedAt: Date | null
  usedBy: string | null
  expiresAt: Date | null
  validDays: number | null
  project?: FakeProject
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

test('buildReusableConflictMessage 会根据授权类型生成稳定冲突文案', () => {
  assert.equal(
    buildReusableConflictMessage({
      code: 'COUNT-CODE',
      licenseMode: 'COUNT',
      remainingCount: 3,
    }),
    '该设备已绑定激活码: COUNT-CODE，请先用完剩余次数（剩余 3 次）',
  )

  assert.equal(
    buildReusableConflictMessage({
      code: 'TIME-CODE',
      licenseMode: 'TIME',
      remainingCount: null,
    }),
    '该设备已激活过激活码: TIME-CODE，同一项目下每台设备只能使用一个有效激活码',
  )
})

test('canReuseProjectBinding 会识别已耗尽次数卡和已过期时间卡', () => {
  assert.equal(
    canReuseProjectBinding({
      licenseMode: 'COUNT',
      remainingCount: 0,
      totalCount: 3,
      isUsed: true,
      usedAt: new Date('2026-03-25T00:00:00.000Z'),
      expiresAt: null,
      validDays: null,
    }),
    true,
  )

  assert.equal(
    canReuseProjectBinding({
      licenseMode: 'COUNT',
      remainingCount: 2,
      totalCount: 3,
      isUsed: true,
      usedAt: new Date('2026-03-25T00:00:00.000Z'),
      expiresAt: null,
      validDays: null,
    }),
    false,
  )

  assert.equal(
    canReuseProjectBinding({
      licenseMode: 'TIME',
      remainingCount: null,
      isUsed: true,
      usedAt: new Date('2026-03-20T00:00:00.000Z'),
      expiresAt: new Date('2026-03-21T00:00:00.000Z'),
      validDays: 1,
    }),
    true,
  )
})

test('findProjectActivationCode 仅返回属于当前项目的激活码', async () => {
  const targetCode: FakeActivationCode = {
    id: 1,
    code: 'MATCH-CODE',
    projectId: 10,
    licenseMode: 'COUNT',
    remainingCount: 2,
    totalCount: 2,
    isUsed: false,
    usedAt: null,
    usedBy: null,
    expiresAt: null,
    validDays: null,
    project: {
      id: 10,
      name: '项目 A',
      projectKey: 'project-a',
    },
  }

  const client = {
    activationCode: {
      findUnique: async ({ where }: { where: { code: string } }) => {
        if (where.code === 'MATCH-CODE') {
          return clone(targetCode)
        }

        if (where.code === 'OTHER-CODE') {
          return {
            ...clone(targetCode),
            code: 'OTHER-CODE',
            projectId: 99,
          }
        }

        return null
      },
    },
  }

  const matched = await findProjectActivationCode(client as never, 10, 'MATCH-CODE')
  const otherProject = await findProjectActivationCode(client as never, 10, 'OTHER-CODE')
  const missing = await findProjectActivationCode(client as never, 10, 'MISSING')

  assert.equal(matched?.code, 'MATCH-CODE')
  assert.equal(otherProject, null)
  assert.equal(missing, null)
})

test('findMachineBinding 会按项目与设备查询当前绑定', async () => {
  const boundCode: FakeActivationCode = {
    id: 2,
    code: 'BOUND-CODE',
    projectId: 20,
    licenseMode: 'COUNT',
    remainingCount: 1,
    totalCount: 2,
    isUsed: true,
    usedAt: new Date('2026-03-25T00:00:00.000Z'),
    usedBy: 'machine-001',
    expiresAt: null,
    validDays: null,
  }

  const client = {
    activationCode: {
      findFirst: async ({ where }: { where: { projectId: number; usedBy: string; isUsed: boolean } }) => {
        if (where.projectId === 20 && where.usedBy === 'machine-001' && where.isUsed === true) {
          return clone(boundCode)
        }

        return null
      },
    },
  }

  const matched = await findMachineBinding(client as never, 20, 'machine-001')
  const missing = await findMachineBinding(client as never, 20, 'machine-002')

  assert.equal(matched?.code, 'BOUND-CODE')
  assert.equal(missing, null)
})

test('releaseReusableMachineBindings 只释放可复用旧绑定，且不会释放目标激活码', async () => {
  const bindings: FakeActivationCode[] = [
    {
      id: 1,
      code: 'TARGET-CODE',
      projectId: 30,
      licenseMode: 'COUNT',
      remainingCount: 2,
      totalCount: 2,
      isUsed: true,
      usedAt: new Date('2026-03-25T00:00:00.000Z'),
      usedBy: 'machine-003',
      expiresAt: null,
      validDays: null,
    },
    {
      id: 2,
      code: 'COUNT-EXHAUSTED',
      projectId: 30,
      licenseMode: 'COUNT',
      remainingCount: 0,
      totalCount: 2,
      isUsed: true,
      usedAt: new Date('2026-03-24T00:00:00.000Z'),
      usedBy: 'machine-003',
      expiresAt: null,
      validDays: null,
    },
    {
      id: 3,
      code: 'TIME-EXPIRED',
      projectId: 30,
      licenseMode: 'TIME',
      remainingCount: null,
      isUsed: true,
      usedAt: new Date('2026-03-20T00:00:00.000Z'),
      usedBy: 'machine-003',
      expiresAt: new Date('2026-03-21T00:00:00.000Z'),
      validDays: 1,
    },
    {
      id: 4,
      code: 'COUNT-ACTIVE',
      projectId: 30,
      licenseMode: 'COUNT',
      remainingCount: 1,
      totalCount: 2,
      isUsed: true,
      usedAt: new Date('2026-03-25T00:00:00.000Z'),
      usedBy: 'machine-003',
      expiresAt: null,
      validDays: null,
    },
  ]

  const updateManyCalls: Array<{ ids: number[]; usedBy: null }> = []

  const client = {
    activationCode: {
      findMany: async () => bindings.map((binding) => clone(binding)),
      updateMany: async ({ where, data }: { where: { id: { in: number[] } }; data: { usedBy: null } }) => {
        updateManyCalls.push({ ids: where.id.in, usedBy: data.usedBy })
        return { count: where.id.in.length }
      },
    },
  }

  await releaseReusableMachineBindings(client as never, 30, 'machine-003', 'TARGET-CODE')

  assert.deepEqual(updateManyCalls, [
    {
      ids: [2, 3],
      usedBy: null,
    },
  ])
})

test('isProjectMachineUniqueConstraintError 仅识别 projectId + usedBy 的唯一约束冲突', () => {
  assert.equal(
    isProjectMachineUniqueConstraintError({
      code: 'P2002',
      meta: {
        target: ['projectId', 'usedBy'],
      },
    }),
    true,
  )

  assert.equal(
    isProjectMachineUniqueConstraintError({
      code: 'P2002',
      meta: {
        target: ['requestId'],
      },
    }),
    false,
  )
})
