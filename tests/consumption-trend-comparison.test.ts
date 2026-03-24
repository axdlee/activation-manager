import assert from 'node:assert/strict'
import test from 'node:test'

import { buildConsumptionTrendComparisonSeries } from '../src/lib/consumption-trend-comparison'

test('buildConsumptionTrendComparisonSeries 会按时间桶对齐主项目与对比项目趋势', () => {
  const result = buildConsumptionTrendComparisonSeries(
    [
      { date: '2026-03-18', label: '03-18', count: 2 },
      { date: '2026-03-19', label: '03-19', count: 0 },
    ],
    [
      { date: '2026-03-18', label: '03-18', count: 1 },
      { date: '2026-03-19', label: '03-19', count: 3 },
    ],
  )

  assert.deepEqual(result, {
    points: [
      { date: '2026-03-18', label: '03-18', primaryCount: 2, secondaryCount: 1 },
      { date: '2026-03-19', label: '03-19', primaryCount: 0, secondaryCount: 3 },
    ],
    hiddenZeroBucketCount: 0,
    maxCount: 3,
  })
})

test('buildConsumptionTrendComparisonSeries 在仅显示非零桶时仅隐藏双方都为 0 的时间桶', () => {
  const result = buildConsumptionTrendComparisonSeries(
    [
      { date: '2026-03-18', label: '03-18', count: 0 },
      { date: '2026-03-19', label: '03-19', count: 0 },
      { date: '2026-03-20', label: '03-20', count: 2 },
    ],
    [
      { date: '2026-03-18', label: '03-18', count: 1 },
      { date: '2026-03-19', label: '03-19', count: 0 },
      { date: '2026-03-20', label: '03-20', count: 0 },
    ],
    {
      hideZeroBuckets: true,
    },
  )

  assert.deepEqual(result, {
    points: [
      { date: '2026-03-18', label: '03-18', primaryCount: 0, secondaryCount: 1 },
      { date: '2026-03-20', label: '03-20', primaryCount: 2, secondaryCount: 0 },
    ],
    hiddenZeroBucketCount: 1,
    maxCount: 2,
  })
})

test('buildConsumptionTrendComparisonSeries 在对比项目缺少时间桶时会补 0', () => {
  const result = buildConsumptionTrendComparisonSeries(
    [
      { date: '2026-03-18', label: '03-18', count: 1 },
      { date: '2026-03-19', label: '03-19', count: 2 },
    ],
    [
      { date: '2026-03-18', label: '03-18', count: 3 },
    ],
  )

  assert.deepEqual(result, {
    points: [
      { date: '2026-03-18', label: '03-18', primaryCount: 1, secondaryCount: 3 },
      { date: '2026-03-19', label: '03-19', primaryCount: 2, secondaryCount: 0 },
    ],
    hiddenZeroBucketCount: 0,
    maxCount: 3,
  })
})
