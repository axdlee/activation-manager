/**
 * 批次4（v2.9.0 复查高危项 3）回归：消费趋势方言无关化。
 *
 * 修复前：趋势分桶用 SQLite strftime/unixepoch 原生 SQL，PG 下报错。
 * 修复后：licenseConsumption.findMany 取 createdAt + JS 分桶，
 * 空桶补齐、周桶（周一锚点）、月桶、上一周期对比口径保持不变。
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { getLicenseConsumptionTrend } from '../src/lib/license-analytics-service'

function consumptionAt(iso: string) {
  return { createdAt: new Date(iso) }
}

test('日粒度：findMany+JS 分桶，空桶补齐与对比摘要口径不变', async () => {
  const findManyArgs: Array<Record<string, unknown>> = []
  let countArg: Record<string, unknown> | undefined

  const client = {
    $queryRaw: async () => {
      throw new Error('趋势不应再走方言原生 SQL')
    },
    project: {
      findUnique: async () => ({ id: 42 }),
    },
    licenseConsumption: {
      findMany: async (args: Record<string, unknown>) => {
        findManyArgs.push(args)
        return [
          consumptionAt('2026-03-20T08:00:00.000Z'),
          consumptionAt('2026-03-20T23:59:59.999Z'),
          consumptionAt('2026-03-22T12:34:56.000Z'),
        ]
      },
      count: async (args: Record<string, unknown>) => {
        countArg = args
        return 1
      },
    },
  }

  const trend = await getLicenseConsumptionTrend(client as never, {
    projectKey: 'trend-aggregation-project',
    days: 7,
    now: new Date('2026-03-24T12:00:00.000Z'),
  })

  assert.equal(findManyArgs.length, 1)
  const where = (findManyArgs[0] as { where: { createdAt: { gte: Date; lte: Date }; activationCode: { projectId: number } } }).where
  assert.deepEqual(where.createdAt, {
    gte: new Date('2026-03-18T00:00:00.000Z'),
    lte: new Date('2026-03-24T23:59:59.999Z'),
  })
  assert.deepEqual(where.activationCode, { projectId: 42 })
  const countWhere = (countArg as { where: { activationCode: { projectId: number } } }).where
  assert.deepEqual(countWhere.activationCode, { projectId: 42 })

  assert.equal(trend.days, 7)
  assert.equal(trend.granularity, 'day')
  assert.equal(trend.totalConsumptions, 3)
  assert.equal(trend.maxBucketConsumptions, 2)
  assert.equal(trend.maxDailyConsumptions, 2)
  assert.deepEqual(trend.comparison, {
    previousRangeStart: '2026-03-11',
    previousRangeEnd: '2026-03-17',
    previousTotalConsumptions: 1,
    changeCount: 2,
    changePercentage: 200,
  })
  assert.deepEqual(trend.points, [
    { date: '2026-03-18', label: '03-18', count: 0 },
    { date: '2026-03-19', label: '03-19', count: 0 },
    { date: '2026-03-20', label: '03-20', count: 2 },
    { date: '2026-03-21', label: '03-21', count: 0 },
    { date: '2026-03-22', label: '03-22', count: 1 },
    { date: '2026-03-23', label: '03-23', count: 0 },
    { date: '2026-03-24', label: '03-24', count: 0 },
  ])
})

test('周粒度：桶锚定周一；月粒度：桶锚定当月 1 号', async () => {
  const client = {
    $queryRaw: async () => {
      throw new Error('趋势不应再走方言原生 SQL')
    },
    project: {
      findUnique: async () => null,
    },
    licenseConsumption: {
      findMany: async () => [
        // 2026-03-22 是周日 → 归入周一 2026-03-16 桶
        consumptionAt('2026-03-22T10:00:00.000Z'),
        // 2026-03-17 周二 → 2026-03-16 桶
        consumptionAt('2026-03-17T10:00:00.000Z'),
        // 2026-03-02 → 月桶 2026-03-01
        consumptionAt('2026-03-02T10:00:00.000Z'),
      ],
      count: async () => 0,
    },
  }

  const weekTrend = await getLicenseConsumptionTrend(client as never, {
    days: 14,
    granularity: 'week',
    now: new Date('2026-03-24T12:00:00.000Z'),
  })
  const week16 = weekTrend.points.find((point) => point.date === '2026-03-16')
  assert.ok(week16, '应存在 2026-03-16 周桶')
  assert.equal(week16!.count, 2, '周日与周二都应归入同一周桶')

  const monthTrend = await getLicenseConsumptionTrend(client as never, {
    days: 60,
    granularity: 'month',
    now: new Date('2026-03-24T12:00:00.000Z'),
  })
  const march = monthTrend.points.find((point) => point.date === '2026-03-01')
  assert.ok(march, '应存在 2026-03 月桶')
  assert.equal(march!.count, 3)
  assert.equal(monthTrend.points[0]!.date, '2026-01-01', '60 天窗口应从 1 月桶开始')
})

test('projectKey 未命中项目时不带项目过滤（全库趋势）', async () => {
  const findManyArgs: Array<Record<string, unknown>> = []

  const client = {
    $queryRaw: async () => {
      throw new Error('趋势不应再走方言原生 SQL')
    },
    project: {
      findUnique: async () => null,
    },
    licenseConsumption: {
      findMany: async (args: Record<string, unknown>) => {
        findManyArgs.push(args)
        return []
      },
      count: async () => 0,
    },
  }

  await getLicenseConsumptionTrend(client as never, {
    days: 7,
    now: new Date('2026-03-24T12:00:00.000Z'),
  })

  const where = (findManyArgs[0] as { where: Record<string, unknown> }).where
  assert.equal(where.activationCode, undefined, '无项目过滤时不得携带 activationCode 条件')
})
