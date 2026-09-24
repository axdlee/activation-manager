/**
 * 批次4（v2.9.0 复查高危项 3）回归：统计聚合方言无关化。
 *
 * 修复前：看板统计/项目统计走 SQLite 方言原生 SQL（"isUsed" = 1、
 * createdAt/1000、strftime/unixepoch），PostgreSQL 下全部报错。
 * 修复后：Prisma findMany 最小字段集 + JS 聚合，同一代码路径兼容
 * SQLite/PostgreSQL，且统一过滤 deletedAt（低危项：软删除码计入统计）。
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

function codeRow(overrides: Record<string, unknown>) {
  return {
    projectId: 1,
    isUsed: false,
    licenseMode: 'TIME',
    usedAt: null as Date | null,
    expiresAt: null as Date | null,
    validDays: null as number | null,
    remainingCount: null as number | null,
    totalCount: null as number | null,
    consumedCount: 0,
    ...overrides,
  }
}

test('getActivationCodeStats：JS 聚合口径与原 SQL CASE 一致，且查询过滤 deletedAt', async () => {
  // 服务内部用真实 Date.now()，相对日期在测试内现算（日级余量无竞态）
  const now = new Date()
  const findManyArgs: Array<Record<string, unknown>> = []

  const client = {
    $queryRaw: async () => {
      throw new Error('统计不应再走方言原生 SQL')
    },
    activationCode: {
      findMany: async (args: Record<string, unknown>) => {
        findManyArgs.push(args)
        return [
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
        ]
      },
    },
  }

  const stats = await getActivationCodeStats(client as never)

  assert.equal(findManyArgs.length, 1)
  assert.deepEqual((findManyArgs[0] as { where: unknown }).where, { deletedAt: null }, '统计必须排除软删除码')

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
    activationCode: {
      findMany: async () => [
        codeRow({ projectId: 1 }),
        codeRow({ projectId: 1, licenseMode: 'COUNT', isUsed: true, remainingCount: 7, totalCount: 10, consumedCount: 3 }),
        codeRow({ projectId: 1, licenseMode: 'COUNT', isUsed: true, remainingCount: 0, totalCount: 2, consumedCount: 2 }),
        codeRow({ projectId: 2, isUsed: true, usedAt: new Date(now.getTime() - 10 * DAY), validDays: 5 }),
        codeRow({ projectId: 3 }),
      ],
    },
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
