import assert from 'node:assert/strict'
import test from 'node:test'

import { consumeLicense } from '../src/lib/license-service'

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

type FakeLicenseConsumption = {
  id: number
  requestId: string
  activationCodeId: number
  machineId: string
  remainingCountAfter: number
  createdAt: Date
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

function createRaceTestClient({
  totalCount,
  syncActivationLookups = false,
  syncConsumptionCreates = false,
}: {
  totalCount: number
  syncActivationLookups?: boolean
  syncConsumptionCreates?: boolean
}) {
  const project: FakeProject = {
    id: 1,
    name: '并发项目',
    projectKey: 'race-project',
    isEnabled: true,
  }

  const activationCode: FakeActivationCode = {
    id: 1,
    code: 'RACE-CODE-001',
    isUsed: false,
    usedAt: null,
    usedBy: null,
    createdAt: new Date('2026-03-25T00:00:00.000Z'),
    updatedAt: new Date('2026-03-25T00:00:00.000Z'),
    expiresAt: null,
    validDays: null,
    cardType: `${totalCount}次卡`,
    projectId: project.id,
    licenseMode: 'COUNT',
    totalCount,
    remainingCount: totalCount,
    consumedCount: 0,
  }

  const consumptions: FakeLicenseConsumption[] = []
  let nextConsumptionId = 1

  const waitForActivationLookup = syncActivationLookups ? createBarrier(2) : null
  const waitForConsumptionCreate = syncConsumptionCreates ? createBarrier(2) : null
  let activationLookupCount = 0
  let consumptionCreateCount = 0

  function getActivationCodeByWhere(where: { id?: number; code?: string }) {
    if ((where.id && activationCode.id === where.id) || (where.code && activationCode.code === where.code)) {
      return activationCode
    }

    return null
  }

  function matchesUsedByCondition(
    code: FakeActivationCode,
    condition: { usedBy?: string | null } | undefined,
  ) {
    if (!condition || !Object.prototype.hasOwnProperty.call(condition, 'usedBy')) {
      return true
    }

    return code.usedBy === condition.usedBy
  }

  function matchesActivationCodeWhere(code: FakeActivationCode, where: Record<string, unknown>) {
    if (typeof where.id === 'number' && code.id !== where.id) {
      return false
    }

    if (typeof where.projectId === 'number' && code.projectId !== where.projectId) {
      return false
    }

    if (typeof where.licenseMode === 'string' && code.licenseMode !== where.licenseMode) {
      return false
    }

    if (typeof where.isUsed === 'boolean' && code.isUsed !== where.isUsed) {
      return false
    }

    if (where.usedAt === null && code.usedAt !== null) {
      return false
    }

    if (
      typeof where.remainingCount === 'object' &&
      where.remainingCount !== null &&
      'gt' in where.remainingCount &&
      typeof (where.remainingCount as { gt?: number }).gt === 'number' &&
      (code.remainingCount ?? 0) <= (where.remainingCount as { gt: number }).gt
    ) {
      return false
    }

    if (Array.isArray(where.OR)) {
      return where.OR.some((condition) =>
        matchesUsedByCondition(code, condition as { usedBy?: string | null }),
      )
    }

    return true
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
        const foundCode = getActivationCodeByWhere(where)
        if (!foundCode) {
          return null
        }

        activationLookupCount += 1
        if (waitForActivationLookup && activationLookupCount <= 2) {
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
        if (
          activationCode.projectId === where.projectId &&
          activationCode.usedBy === where.usedBy &&
          activationCode.isUsed === where.isUsed
        ) {
          return clone(activationCode)
        }

        return null
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: number }
        data: Record<string, unknown>
      }) => {
        if (activationCode.id !== where.id) {
          throw new Error('activationCode 不存在')
        }

        if (typeof data.isUsed === 'boolean') {
          activationCode.isUsed = data.isUsed
        }

        if (data.usedAt instanceof Date || data.usedAt === null) {
          activationCode.usedAt = data.usedAt
        }

        if (typeof data.usedBy === 'string' || data.usedBy === null) {
          activationCode.usedBy = data.usedBy
        }

        if (typeof data.remainingCount === 'number' || data.remainingCount === null) {
          activationCode.remainingCount = data.remainingCount
        }

        if (
          typeof data.consumedCount === 'object' &&
          data.consumedCount !== null &&
          'increment' in data.consumedCount
        ) {
          activationCode.consumedCount += (data.consumedCount as { increment: number }).increment
        }

        activationCode.updatedAt = new Date('2026-03-25T00:00:01.000Z')

        return clone(activationCode)
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>
        data: Record<string, unknown>
      }) => {
        if (!matchesActivationCodeWhere(activationCode, where)) {
          return { count: 0 }
        }

        if (typeof data.isUsed === 'boolean') {
          activationCode.isUsed = data.isUsed
        }

        if (data.usedAt instanceof Date || data.usedAt === null) {
          activationCode.usedAt = data.usedAt
        }

        if (typeof data.usedBy === 'string' || data.usedBy === null) {
          activationCode.usedBy = data.usedBy
        }

        if (
          typeof data.remainingCount === 'object' &&
          data.remainingCount !== null &&
          'decrement' in data.remainingCount
        ) {
          activationCode.remainingCount =
            (activationCode.remainingCount ?? 0) -
            (data.remainingCount as { decrement: number }).decrement
        }

        if (
          typeof data.consumedCount === 'object' &&
          data.consumedCount !== null &&
          'increment' in data.consumedCount
        ) {
          activationCode.consumedCount += (data.consumedCount as { increment: number }).increment
        }

        activationCode.updatedAt = new Date('2026-03-25T00:00:01.000Z')

        return { count: 1 }
      },
    },
    licenseConsumption: {
      findUnique: async ({
        where,
        include,
      }: {
        where: { requestId: string }
        include?: { activationCode?: boolean }
      }) => {
        const foundConsumption = consumptions.find((item) => item.requestId === where.requestId)
        if (!foundConsumption) {
          return null
        }

        const result = clone(foundConsumption) as FakeLicenseConsumption & {
          activationCode?: FakeActivationCode
        }

        if (include?.activationCode) {
          result.activationCode = clone(activationCode)
        }

        return result
      },
      create: async ({
        data,
      }: {
        data: {
          requestId: string
          activationCodeId: number
          machineId: string
          remainingCountAfter: number
        }
      }) => {
        consumptionCreateCount += 1
        if (waitForConsumptionCreate && consumptionCreateCount <= 2) {
          await waitForConsumptionCreate()
        }

        if (consumptions.some((item) => item.requestId === data.requestId)) {
          throw {
            code: 'P2002',
            meta: {
              target: ['requestId'],
            },
          }
        }

        const createdConsumption: FakeLicenseConsumption = {
          id: nextConsumptionId,
          requestId: data.requestId,
          activationCodeId: data.activationCodeId,
          machineId: data.machineId,
          remainingCountAfter: data.remainingCountAfter,
          createdAt: new Date('2026-03-25T00:00:02.000Z'),
        }
        nextConsumptionId += 1
        consumptions.push(createdConsumption)
        return clone(createdConsumption)
      },
      update: async ({
        where,
        data,
      }: {
        where: { requestId: string }
        data: { remainingCountAfter: number }
      }) => {
        const targetConsumption = consumptions.find((item) => item.requestId === where.requestId)
        if (!targetConsumption) {
          throw new Error('licenseConsumption 不存在')
        }

        targetConsumption.remainingCountAfter = data.remainingCountAfter
        return clone(targetConsumption)
      },
      delete: async ({ where }: { where: { requestId: string } }) => {
        const targetIndex = consumptions.findIndex((item) => item.requestId === where.requestId)
        if (targetIndex < 0) {
          throw new Error('licenseConsumption 不存在')
        }

        const [deletedConsumption] = consumptions.splice(targetIndex, 1)
        return clone(deletedConsumption)
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
      activationCode,
      consumptions,
    },
  }
}

test('consumeLicense 在并发相同 requestId 场景下只扣减一次并返回幂等结果', async () => {
  const { prisma, state } = createRaceTestClient({
    totalCount: 2,
    syncConsumptionCreates: true,
  })

  const [firstResult, secondResult] = await Promise.allSettled([
    consumeLicense(prisma as never, {
      projectKey: 'race-project',
      code: 'RACE-CODE-001',
      machineId: 'machine-001',
      requestId: 'req-same',
    }),
    consumeLicense(prisma as never, {
      projectKey: 'race-project',
      code: 'RACE-CODE-001',
      machineId: 'machine-001',
      requestId: 'req-same',
    }),
  ])

  assert.equal(firstResult.status, 'fulfilled')
  assert.equal(secondResult.status, 'fulfilled')

  const results = [firstResult.value, secondResult.value]
  assert.equal(results.filter((item) => item.success).length, 2)
  assert.equal(results.filter((item) => item.idempotent === true).length, 1)
  assert.equal(results.filter((item) => item.idempotent === false).length, 1)
  assert.equal(state.activationCode.remainingCount, 1)
  assert.equal(state.activationCode.consumedCount, 1)
  assert.equal(state.consumptions.length, 1)
  assert.equal(state.consumptions[0]?.requestId, 'req-same')
  assert.equal(state.consumptions[0]?.remainingCountAfter, 1)
})

test('consumeLicense 在并发不同设备消费同一激活码时只能允许一个设备成功绑定并扣次', async () => {
  const { prisma, state } = createRaceTestClient({
    totalCount: 2,
    syncActivationLookups: true,
  })

  const [firstResult, secondResult] = await Promise.all([
    consumeLicense(prisma as never, {
      projectKey: 'race-project',
      code: 'RACE-CODE-001',
      machineId: 'machine-A',
      requestId: 'req-a',
    }),
    consumeLicense(prisma as never, {
      projectKey: 'race-project',
      code: 'RACE-CODE-001',
      machineId: 'machine-B',
      requestId: 'req-b',
    }),
  ])

  const successResults = [firstResult, secondResult].filter((item) => item.success)
  const failedResults = [firstResult, secondResult].filter((item) => !item.success)

  assert.equal(successResults.length, 1)
  assert.equal(failedResults.length, 1)
  assert.equal(failedResults[0]?.message, '激活码已被其他设备使用')
  assert.equal(state.activationCode.remainingCount, 1)
  assert.equal(state.activationCode.consumedCount, 1)
  assert.equal(state.consumptions.length, 1)
  assert.match(state.activationCode.usedBy ?? '', /^machine-[AB]$/)
})
