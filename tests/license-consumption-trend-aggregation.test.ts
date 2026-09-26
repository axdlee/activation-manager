/**
 * 批次4（v2.9.0 复查高危项 3）回归 + v2.11.0 评审批次 3：消费趋势聚合。
 *
 * 修复前：趋势分桶用 SQLite strftime/unixepoch 原生 SQL，PG 下报错。
 * v2.10.0 改为 licenseConsumption.findMany 取 createdAt + JS 分桶。
 * v2.11.0：分桶进一步下沉为「桶区间并行 count」，窗口内记录不再拉进
 * 内存；空桶补齐、周桶（周一锚点）、月桶、上一周期对比口径保持不变。
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { getLicenseConsumptionTrend } from '../src/lib/license-analytics-service'

/** 桶区间 count mock：按 where.AND[1].createdAt.gte 的日期前缀返回计数 */
function bucketCountMock(countsByStartDate: Record<string, number>, previousRangeCount = 0) {
  return async (args: Record<string, unknown>) => {
    const where = args.where as { AND?: Array<Record<string, unknown>> }
    if (!Array.isArray(where?.AND)) {
      return previousRangeCount // 上一周期对比的 count（无 AND 包装）
    }
    const range = where.AND[1] as { createdAt: { gte: Date; lt: Date } }
    const key = range.createdAt.gte.toISOString().slice(0, 10)
    return countsByStartDate[key] ?? 0
  }
}

function bucketRangeOf(args: Record<string, unknown>) {
  const where = args.where as { AND: Array<Record<string, unknown>> }
  return where.AND[1] as { createdAt: { gte: Date; lt: Date } }
}

function baseWhereOf(args: Record<string, unknown>) {
  const where = args.where as { AND: Array<Record<string, unknown>> }
  return where.AND[0] as {
    createdAt: { gte: Date; lte: Date }
    activationCode?: { projectId: number }
  }
}

test('日粒度：桶区间 count，空桶补齐与对比摘要口径不变', async () => {
  const bucketCountArgs: Array<Record<string, unknown>> = []

  const client = {
    $queryRaw: async () => {
      throw new Error('趋势不应再走方言原生 SQL')
    },
    project: {
      findUnique: async () => ({ id: 42 }),
    },
    licenseConsumption: {
      count: async (args: Record<string, unknown>) => {
        const where = args.where as { AND?: Array<Record<string, unknown>> }
        if (Array.isArray(where?.AND)) {
          bucketCountArgs.push(args)
        }
        return bucketCountMock({ '2026-03-20': 2, '2026-03-22': 1 }, 1)(args)
      },
    },
  }

  const trend = await getLicenseConsumptionTrend(client as never, {
    projectKey: 'trend-aggregation-project',
    days: 7,
    now: new Date('2026-03-24T12:00:00.000Z'),
  })

  assert.equal(bucketCountArgs.length, 7, '每个桶一次 count')
  const baseWhere = baseWhereOf(bucketCountArgs[0]!)
  assert.deepEqual(baseWhere.createdAt, {
    gte: new Date('2026-03-18T00:00:00.000Z'),
    lte: new Date('2026-03-24T23:59:59.999Z'),
  })
  assert.deepEqual(baseWhere.activationCode, { projectId: 42 })
  const firstBucketRange = bucketRangeOf(bucketCountArgs[0]!)
  assert.deepEqual(firstBucketRange.createdAt, {
    gte: new Date('2026-03-18T00:00:00.000Z'),
    lt: new Date('2026-03-19T00:00:00.000Z'),
  })

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
      count: bucketCountMock({
        // 2026-03-22 周日与 2026-03-17 周二都归入 2026-03-16 周桶；
        // 2026-03-02 归入 2026-03 月桶
        '2026-03-16': 2,
        '2026-03-01': 3,
      }, 0),
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
  const bucketCountArgs: Array<Record<string, unknown>> = []

  const client = {
    $queryRaw: async () => {
      throw new Error('趋势不应再走方言原生 SQL')
    },
    project: {
      findUnique: async () => null,
    },
    licenseConsumption: {
      count: async (args: Record<string, unknown>) => {
        const where = args.where as { AND?: Array<Record<string, unknown>> }
        if (Array.isArray(where?.AND)) {
          bucketCountArgs.push(args)
        }
        return 0
      },
    },
  }

  await getLicenseConsumptionTrend(client as never, {
    days: 7,
    now: new Date('2026-03-24T12:00:00.000Z'),
  })

  const where = baseWhereOf(bucketCountArgs[0]!)
  assert.equal(where.activationCode, undefined, '无项目过滤时不得携带 activationCode 条件')
})
