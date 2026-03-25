import assert from 'node:assert/strict'
import test from 'node:test'

import { getLicenseConsumptionTrend } from '../src/lib/license-analytics-service'

test('getLicenseConsumptionTrend 在数据库聚合路径下仍会补齐空桶并返回上一周期对比摘要', async () => {
  const queryCalls: unknown[][] = []

  const client = {
    project: {
      findUnique: async () => ({
        id: 42,
      }),
    },
    licenseConsumption: {
      findMany: async () => {
        throw new Error('趋势聚合不应再回退到 licenseConsumption.findMany 全量查询')
      },
    },
    $queryRaw: async (...args: unknown[]) => {
      queryCalls.push(args)

      if (queryCalls.length === 1) {
        return [
          {
            bucketDate: '2026-03-20',
            consumptionCount: 2,
          },
          {
            bucketDate: '2026-03-22',
            consumptionCount: 1,
          },
        ]
      }

      return [
        {
          totalConsumptions: 1,
        },
      ]
    },
  }

  const trend = await getLicenseConsumptionTrend(client as never, {
    projectKey: 'trend-aggregation-project',
    days: 7,
    now: new Date('2026-03-24T12:00:00.000Z'),
  })

  assert.equal(queryCalls.length, 2)
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
