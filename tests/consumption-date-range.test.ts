import assert from 'node:assert/strict'
import test from 'node:test'

import {
  formatDateTimeLocal,
  getConsumptionQuickRange,
} from '../src/lib/consumption-date-range'

test('formatDateTimeLocal 会输出 datetime-local 所需的本地时间格式', () => {
  const date = new Date(2026, 2, 24, 15, 6, 45)

  const value = formatDateTimeLocal(date)

  assert.equal(value, '2026-03-24T15:06')
})

test('getConsumptionQuickRange 对今天返回当天起止时间', () => {
  const range = getConsumptionQuickRange('today', new Date(2026, 2, 24, 15, 30, 0))

  assert.deepEqual(range, {
    createdFrom: '2026-03-24T00:00',
    createdTo: '2026-03-24T23:59',
  })
})

test('getConsumptionQuickRange 对最近7天返回包含今天的 7 天范围', () => {
  const range = getConsumptionQuickRange('last7Days', new Date(2026, 2, 24, 15, 30, 0))

  assert.deepEqual(range, {
    createdFrom: '2026-03-18T00:00',
    createdTo: '2026-03-24T23:59',
  })
})

test('getConsumptionQuickRange 对最近30天返回包含今天的 30 天范围', () => {
  const range = getConsumptionQuickRange('last30Days', new Date(2026, 2, 24, 15, 30, 0))

  assert.deepEqual(range, {
    createdFrom: '2026-02-23T00:00',
    createdTo: '2026-03-24T23:59',
  })
})
