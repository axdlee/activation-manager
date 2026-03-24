import assert from 'node:assert/strict'
import test from 'node:test'

import { getVisibleConsumptionTrendPoints } from '../src/lib/consumption-trend-display'

const points = [
  { date: '2026-03-18', label: '03-18', count: 0 },
  { date: '2026-03-19', label: '03-19', count: 2 },
  { date: '2026-03-20', label: '03-20', count: 0 },
  { date: '2026-03-21', label: '03-21', count: 1 },
]

test('getVisibleConsumptionTrendPoints 在关闭仅显示非零桶时返回全部时间桶', () => {
  const result = getVisibleConsumptionTrendPoints(points, {
    hideZeroBuckets: false,
  })

  assert.deepEqual(result, {
    points,
    hiddenZeroBucketCount: 0,
  })
})

test('getVisibleConsumptionTrendPoints 在开启仅显示非零桶时过滤 0 扣次时间桶', () => {
  const result = getVisibleConsumptionTrendPoints(points, {
    hideZeroBuckets: true,
  })

  assert.deepEqual(result, {
    points: [
      { date: '2026-03-19', label: '03-19', count: 2 },
      { date: '2026-03-21', label: '03-21', count: 1 },
    ],
    hiddenZeroBucketCount: 2,
  })
})

test('getVisibleConsumptionTrendPoints 在全部为 0 时会返回空数组与隐藏数量', () => {
  const result = getVisibleConsumptionTrendPoints(
    [
      { date: '2026-03-18', label: '03-18', count: 0 },
      { date: '2026-03-19', label: '03-19', count: 0 },
    ],
    {
      hideZeroBuckets: true,
    },
  )

  assert.deepEqual(result, {
    points: [],
    hiddenZeroBucketCount: 2,
  })
})
