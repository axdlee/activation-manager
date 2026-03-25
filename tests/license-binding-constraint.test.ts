import assert from 'node:assert/strict'
import test from 'node:test'

import { activateLicense, consumeLicense } from '../src/lib/license-service'

type FakeProject = {
  id: number
  name: string
  projectKey: string
  isEnabled: boolean
}

type FakeActivationCode = {
  id: number
  code: string
  isUsed: boolean
  usedAt: Date | null
  usedBy: string | null
  createdAt: Date
  updatedAt: Date
  expiresAt: Date | null
  validDays: number | null
  cardType: string | null
  projectId: number
  licenseMode: 'COUNT'
  totalCount: number | null
  remainingCount: number | null
  consumedCount: number
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function createBarrier(participants: number) {
  let arrived = 0
  let released = false
  let release!: () => void
  const waiting = new Promise<void>((resolve) => {
    release = () => {
      if (!released) {
        released = true
        resolve()
      }
    }
  })

  return async () => {
    arrived += 1
    if (arrived >= participants) {
      release()
    }

    await waiting
  }
}

function createProjectMachineConstraintRaceClient() {
  const project: FakeProject = {
    id: 1,
    name: '唯一绑定项目',
    projectKey: 'unique-binding-project',
    isEnabled: true,
  }

  const codes: FakeActivationCode[] = [
    {
      id: 1,
      code: 'UNIQUE-CODE-A',
      isUsed: false,
      usedAt: null,
      usedBy: null,
      createdAt: new Date('2026-03-25T00:00:00.000Z'),
      updatedAt: new Date('2026-03-25T00:00:00.000Z'),
      expiresAt: null,
      validDays: null,
      cardType: '2次卡',
      projectId: project.id,
      licenseMode: 'COUNT',
      totalCount: 2,
      remainingCount: 2,
      consumedCount: 0,
    },
    {
      id: 2,
      code: 'UNIQUE-CODE-B',
      isUsed: false,
      usedAt: null,
      usedBy: null,
      createdAt: new Date('2026-03-25T00:00:00.000Z'),
      updatedAt: new Date('2026-03-25T00:00:00.000Z'),
      expiresAt: null,
      validDays: null,
      cardType: '2次卡',
      projectId: project.id,
      licenseMode: 'COUNT',
      totalCount: 2,
      remainingCount: 2,
      consumedCount: 0,
    },
  ]

  const waitForActivationLookup = createBarrier(2)
  let activationLookupCount = 0

  function findCode(where: { id?: number; code?: string }) {
    return codes.find((code) => {
      if (typeof where.id === 'number') {
        return code.id === where.id
      }

      if (typeof where.code === 'string') {
        return code.code === where.code
      }

      return false
    })
  }

  function applyActivationCodeData(code: FakeActivationCode, data: Record<string, unknown>) {
    if (typeof data.isUsed === 'boolean') {
      code.isUsed = data.isUsed
    }

    if (data.usedAt instanceof Date || data.usedAt === null) {
      code.usedAt = data.usedAt
    }

    if (typeof data.usedBy === 'string' || data.usedBy === null) {
      code.usedBy = data.usedBy
    }

    if (
      typeof data.remainingCount === 'object' &&
      data.remainingCount !== null &&
      'decrement' in data.remainingCount
    ) {
      code.remainingCount =
        (code.remainingCount ?? 0) - (data.remainingCount as { decrement: number }).decrement
    }

    if (
      typeof data.consumedCount === 'object' &&
      data.consumedCount !== null &&
      'increment' in data.consumedCount
    ) {
      code.consumedCount += (data.consumedCount as { increment: number }).increment
    }

    code.updatedAt = new Date('2026-03-25T00:00:01.000Z')
  }

  function maybeThrowProjectMachineUniqueConstraint(
    currentCode: FakeActivationCode,
    data: Record<string, unknown>,
  ) {
    if (typeof data.usedBy !== 'string' || !data.usedBy) {
      return
    }

    const hasConflict = codes.some(
      (code) =>
        code.id !== currentCode.id &&
        code.projectId === currentCode.projectId &&
        code.usedBy === data.usedBy,
    )

    if (hasConflict) {
      throw {
        code: 'P2002',
        meta: {
          target: ['projectId', 'usedBy'],
        },
      }
    }
  }

  const tx = {
    project: {
      findUnique: async ({ where }: { where: { projectKey?: string } }) => {
        if (where.projectKey === project.projectKey) {
          return clone(project)
        }

        return null
      },
    },
    activationCode: {
      findUnique: async ({
        where,
        include,
      }: {
        where: { id?: number; code?: string }
        include?: { project?: { select: Record<string, boolean> } }
      }) => {
        const foundCode = findCode(where)
        if (!foundCode) {
          return null
        }

        activationLookupCount += 1
        if (activationLookupCount <= 2) {
          await waitForActivationLookup()
        }

        const result = clone(foundCode) as FakeActivationCode & {
          project?: Pick<FakeProject, 'id' | 'name' | 'projectKey'>
        }

        if (include?.project) {
          result.project = {
            id: project.id,
            name: project.name,
            projectKey: project.projectKey,
          }
        }

        return result
      },
      findFirst: async ({
        where,
      }: {
        where: { projectId: number; usedBy: string; isUsed: boolean }
      }) => {
        const foundCode = codes.find(
          (code) =>
            code.projectId === where.projectId &&
            code.usedBy === where.usedBy &&
            code.isUsed === where.isUsed,
        )

        return foundCode ? clone(foundCode) : null
      },
      findMany: async ({
        where,
      }: {
        where: { projectId: number; usedBy: string; isUsed: boolean }
      }) => {
        return codes
          .filter(
            (code) =>
              code.projectId === where.projectId &&
              code.usedBy === where.usedBy &&
              code.isUsed === where.isUsed,
          )
          .map((code) => clone(code))
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: number }
        data: Record<string, unknown>
      }) => {
        const targetCode = findCode(where)
        if (!targetCode) {
          throw new Error('activationCode 不存在')
        }

        maybeThrowProjectMachineUniqueConstraint(targetCode, data)
        applyActivationCodeData(targetCode, data)
        return clone(targetCode)
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: {
          id: number
          projectId: number
          licenseMode?: 'COUNT'
          remainingCount?: { gt: number }
          OR?: Array<{ usedBy?: string | null }>
          usedAt?: null
        }
        data: Record<string, unknown>
      }) => {
        const targetCode = codes.find(
          (code) =>
            code.id === where.id &&
            code.projectId === where.projectId &&
            (where.licenseMode ? code.licenseMode === where.licenseMode : true) &&
            (where.usedAt === null ? code.usedAt === null : true) &&
            (where.remainingCount ? (code.remainingCount ?? 0) > where.remainingCount.gt : true) &&
            (where.OR
              ? where.OR.some((condition) =>
                  Object.prototype.hasOwnProperty.call(condition, 'usedBy')
                    ? code.usedBy === condition.usedBy
                    : true,
                )
              : true),
        )

        if (!targetCode) {
          return { count: 0 }
        }

        maybeThrowProjectMachineUniqueConstraint(targetCode, data)
        applyActivationCodeData(targetCode, data)
        return { count: 1 }
      },
    },
  }

  return {
    prisma: {
      ...tx,
      $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) => callback(tx),
    },
    state: {
      project,
      codes,
    },
  }
}

test('activateLicense 会把同项目同设备唯一约束冲突收敛为稳定业务错误', async () => {
  const { prisma, state } = createProjectMachineConstraintRaceClient()

  const [firstResult, secondResult] = await Promise.all([
    activateLicense(prisma as never, {
      projectKey: 'unique-binding-project',
      code: 'UNIQUE-CODE-A',
      machineId: 'machine-001',
    }),
    activateLicense(prisma as never, {
      projectKey: 'unique-binding-project',
      code: 'UNIQUE-CODE-B',
      machineId: 'machine-001',
    }),
  ])

  const successResults = [firstResult, secondResult].filter((item) => item.success)
  const failedResults = [firstResult, secondResult].filter((item) => !item.success)

  assert.equal(successResults.length, 1)
  assert.equal(failedResults.length, 1)
  assert.match(
    failedResults[0]?.message ?? '',
    /^该设备已绑定激活码: UNIQUE-CODE-[AB]，请先用完剩余次数（剩余 2 次）$/,
  )
  assert.equal(state.codes.filter((code) => code.usedBy === 'machine-001').length, 1)
})

test('consumeLicense 会把同项目同设备唯一约束冲突收敛为稳定业务错误', async () => {
  const { prisma, state } = createProjectMachineConstraintRaceClient()

  const [firstResult, secondResult] = await Promise.all([
    consumeLicense(prisma as never, {
      projectKey: 'unique-binding-project',
      code: 'UNIQUE-CODE-A',
      machineId: 'machine-001',
    }),
    consumeLicense(prisma as never, {
      projectKey: 'unique-binding-project',
      code: 'UNIQUE-CODE-B',
      machineId: 'machine-001',
    }),
  ])

  const successResults = [firstResult, secondResult].filter((item) => item.success)
  const failedResults = [firstResult, secondResult].filter((item) => !item.success)

  assert.equal(successResults.length, 1)
  assert.equal(failedResults.length, 1)
  assert.match(
    failedResults[0]?.message ?? '',
    /^该设备已绑定激活码: UNIQUE-CODE-[AB]，请先用完剩余次数（剩余 1 次）$/,
  )
  assert.equal(state.codes.filter((code) => code.usedBy === 'machine-001').length, 1)
})
