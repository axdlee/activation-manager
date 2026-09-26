/**
 * 批次4（v2.9.0 复查高危项 3）回归 + v2.11.0 评审批次 3：统计聚合。
 *
 * 修复前：看板统计/项目统计走 SQLite 方言原生 SQL，PostgreSQL 下报错。
 * v2.10.0 改为 Prisma findMany 最小字段集 + JS 聚合。
 * v2.11.0：聚合进一步下沉为 Prisma groupBy/_sum/_count + 过期行窄拉，
 * 全表加载不再发生；软删除过滤、active/expired 口径保持不变。
 *
 * 本文件用 mock 客户端钉住数据路径与统计口径；真实库口径见
 * license-analytics-dialect-free.test.ts。
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getActivationCodeStats,
  listProjectStats,
} from '../src/lib/license-analytics-service'

const DAY = 24 * 60 * 60 * 1000

type StatsRow = {
  projectId: number
  isUsed: boolean
  licenseMode: string
  usedAt: Date | null
  expiresAt: Date | null
  validDays: number | null
  remainingCount: number | null
  totalCount: number | null
  consumedCount: number
}

function codeRow(overrides: Partial<StatsRow> = {}): StatsRow {
  return {
    projectId: 1,
    isUsed: false,
    licenseMode: 'TIME',
    usedAt: null,
    expiresAt: null,
    validDays: null,
    remainingCount: null,
    totalCount: null,
    consumedCount: 0,
    ...overrides,
  }
}

/**
 * 模拟激活码表：按新聚合接口分流 groupBy/findMany，且真实计算各桶，
 * 断言失败时能区分「服务算错」与「mock 形状漂移」。
 */
function activationCodeMock(rows: StatsRow[], collectors: { groupByArgs?: unknown[]; findManyArgs?: unknown[] } = {}) {
  const baseWhere = (where: Record<string, unknown>) =>
    (where.deletedAt ?? null) === null
  return {
    groupBy: async (args: Record<string, unknown>) => {
      collectors.groupByArgs?.push(args)
      const by = args.by as string[]
      const where = (args.where ?? {}) as Record<string, unknown>
      const selected = rows.filter(() => baseWhere(where))

      // G1：usage 计数（by 含 isUsed）
      if (by.includes('isUsed')) {
        const buckets = new Map<string, { projectId: number; isUsed: boolean; _count: { _all: number } }>()
        for (const row of selected) {
          const key = `${row.projectId}:${row.isUsed}`
          const bucket = buckets.get(key) ?? { projectId: row.projectId, isUsed: row.isUsed, _count: { _all: 0 } }
          bucket._count._all += 1
          buckets.set(key, bucket)
        }
        return [...buckets.values()]
      }

      const isCount = where.licenseMode === 'COUNT'
      const isUnusedNonCount =
        where.isUsed === false && (where.licenseMode as { not: string } | undefined)?.not === 'COUNT'

      // G1b：未用非 COUNT（恒 active）
      if (isUnusedNonCount) {
        const buckets = new Map<number, { projectId: number; _count: { _all: number } }>()
        for (const row of selected.filter((row) => !row.isUsed && row.licenseMode !== 'COUNT')) {
          const bucket = buckets.get(row.projectId) ?? { projectId: row.projectId, _count: { _all: 0 } }
          bucket._count._all += 1
          buckets.set(row.projectId, bucket)
        }
        return [...buckets.values()]
      }

      // G6：非 COUNT 已用且无任何到期线索（恒 active）
      if (!isCount && where.isUsed === true) {
        const buckets = new Map<number, { projectId: number; _count: { _all: number } }>()
        for (const row of selected.filter((row) => row.isUsed && row.licenseMode !== 'COUNT' && row.usedAt === null && row.expiresAt === null)) {
          const bucket = buckets.get(row.projectId) ?? { projectId: row.projectId, _count: { _all: 0 } }
          bucket._count._all += 1
          buckets.set(row.projectId, bucket)
        }
        return [...buckets.values()]
      }

      if (!isCount) {
        return []
      }

      // G2：COUNT remainingCount 非空 → _sum remainingCount
      if ((where.remainingCount as { not: unknown } | undefined)?.not === null) {
        return groupSum(selected.filter((row) => row.remainingCount !== null), 'remainingCount')
      }
      // G3：COUNT remainingCount 为空 → _sum totalCount
      if (where.remainingCount === null) {
        return groupSum(selected.filter((row) => row.remainingCount === null), 'totalCount')
      }
      // G5：COUNT 行级剩余 > 0 → _count
      if (where.OR) {
        const active = selected.filter(
          (row) => (row.remainingCount !== null && row.remainingCount > 0) || (row.remainingCount === null && (row.totalCount ?? 0) > 0),
        )
        const buckets = new Map<number, { projectId: number; _count: { _all: number } }>()
        for (const row of active) {
          const bucket = buckets.get(row.projectId) ?? { projectId: row.projectId, _count: { _all: 0 } }
          bucket._count._all += 1
          buckets.set(row.projectId, bucket)
        }
        return [...buckets.values()]
      }
      // G4：COUNT 消耗合计 → _sum consumedCount
      return groupSum(selected, 'consumedCount')
    },
    findMany: async (args: Record<string, unknown>) => {
      collectors.findManyArgs?.push(args)
      const where = (args.where ?? {}) as Record<string, unknown>
      const or = (where.OR ?? []) as Array<Record<string, unknown>>
      return rows
        .filter(() => baseWhere(where))
        .filter((row) => row.isUsed && row.licenseMode !== 'COUNT')
        .filter((row) => or.some((clause) => (clause.usedAt !== undefined && row.usedAt !== null) || (clause.expiresAt !== undefined && row.expiresAt !== null)))
        .map((row) => ({
          projectId: row.projectId,
          isUsed: row.isUsed,
          licenseMode: row.licenseMode,
          usedAt: row.usedAt,
          expiresAt: row.expiresAt,
          validDays: row.validDays,
        }))
    },
  }
}

function groupSum(selected: StatsRow[], field: 'remainingCount' | 'totalCount' | 'consumedCount') {
  const buckets = new Map<number, { projectId: number; _sum: Record<string, number | null> }>()
  for (const row of selected) {
    const bucket = buckets.get(row.projectId) ?? { projectId: row.projectId, _sum: {} }
    bucket._sum[field] = (bucket._sum[field] ?? 0) + (row[field] as number)
    buckets.set(row.projectId, bucket)
  }
  return [...buckets.values()]
}

test('getActivationCodeStats：groupBy 聚合口径与原 CASE 一致，且查询过滤 deletedAt', async () => {
  // 服务内部用真实 Date.now()，相对日期在测试内现算（日级余量无竞态）
  const now = new Date()
  const collectors: { groupByArgs: unknown[]; findManyArgs: unknown[] } = { groupByArgs: [], findManyArgs: [] }

  const client = {
    $queryRaw: async () => {
      throw new Error('统计不应再走方言原生 SQL')
    },
    activationCode: activationCodeMock(
      [
        // 未使用 TIME 码（无到期）→ active
        codeRow({}),
        // 已使用 TIME 码，usedAt+validDays 已过 → expired（不再 active）
        codeRow({ isUsed: true, usedAt: new Date(now.getTime() - 10 * DAY), validDays: 5 }),
        // 已使用 TIME 码，usedAt+validDays 未到 → active
        codeRow({ isUsed: true, usedAt: new Date(now.getTime() - 1 * DAY), validDays: 30 }),
        // 已使用 TIME 码，expiresAt 已过 → expired
        codeRow({ isUsed: true, usedAt: new Date(now.getTime() - 40 * DAY), validDays: null, expiresAt: new Date(now.getTime() - 5 * DAY) }),
        // 已使用 TIME 码，无任何到期信息 → active
        codeRow({ isUsed: true }),
        // COUNT 码有剩余 → active
        codeRow({ licenseMode: 'COUNT', isUsed: true, remainingCount: 3, totalCount: 5, consumedCount: 2 }),
        // COUNT 码用尽 → 非 active 非 expired
        codeRow({ licenseMode: 'COUNT', isUsed: true, remainingCount: 0, totalCount: 5, consumedCount: 5 }),
      ],
      collectors,
    ),
  }

  const stats = await getActivationCodeStats(client as never)

  assert.ok(collectors.findManyArgs.length <= 1, 'findMany 至多一次（过期行窄拉）')
  const narrowWhere = (collectors.findManyArgs[0] as { where: Record<string, unknown> } | undefined)?.where
  if (narrowWhere) {
    assert.deepEqual((narrowWhere as { deletedAt: unknown }).deletedAt, null, '统计必须排除软删除码')
  }

  assert.deepEqual(stats, {
    total: 7,
    used: 6, // COUNT 码 isUsed 同样计入 used
    expired: 2,
    active: 4,
  })
})

test('listProjectStats：按项目分组聚合 + COUNT 剩余/消耗合计 + 排序保持', async () => {
  const now = new Date('2026-03-24T12:00:00.000Z')

  const client = {
    $queryRaw: async () => {
      throw new Error('项目统计不应再走方言原生 SQL')
    },
    project: {
      findMany: async () => [
        { id: 2, name: '启用项目', projectKey: 'enabled', isEnabled: true, createdAt: new Date('2026-01-02T00:00:00.000Z') },
        { id: 1, name: '默认项目', projectKey: 'default', isEnabled: true, createdAt: new Date('2026-01-01T00:00:00.000Z') },
        { id: 3, name: '停用项目', projectKey: 'disabled', isEnabled: false, createdAt: new Date('2026-01-03T00:00:00.000Z') },
      ],
    },
    activationCode: activationCodeMock([
      codeRow({ projectId: 1 }),
      codeRow({ projectId: 1, licenseMode: 'COUNT', isUsed: true, remainingCount: 7, totalCount: 10, consumedCount: 3 }),
      codeRow({ projectId: 1, licenseMode: 'COUNT', isUsed: true, remainingCount: 0, totalCount: 2, consumedCount: 2 }),
      codeRow({ projectId: 2, isUsed: true, usedAt: new Date(now.getTime() - 10 * DAY), validDays: 5 }),
      codeRow({ projectId: 3 }),
    ]),
  }

  const rows = await listProjectStats(client as never)

  assert.deepEqual(rows, [
    {
      id: 2,
      name: '启用项目',
      projectKey: 'enabled',
      isEnabled: true,
      totalCodes: 1,
      usedCodes: 1,
      expiredCodes: 1,
      activeCodes: 0,
      countRemainingTotal: 0,
      countConsumedTotal: 0,
    },
    {
      id: 1,
      name: '默认项目',
      projectKey: 'default',
      isEnabled: true,
      totalCodes: 3,
      usedCodes: 2,
      expiredCodes: 0,
      activeCodes: 2,
      countRemainingTotal: 7,
      countConsumedTotal: 5,
    },
    {
      id: 3,
      name: '停用项目',
      projectKey: 'disabled',
      isEnabled: false,
      totalCodes: 1,
      usedCodes: 0,
      expiredCodes: 0,
      activeCodes: 1,
      countRemainingTotal: 0,
      countConsumedTotal: 0,
    },
  ])
})
