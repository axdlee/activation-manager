import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getConsumptionRefreshStatus,
  getConsumptionRefreshStatusText,
} from '../src/lib/consumption-refresh-status'

test('getConsumptionRefreshStatusText 在自动刷新中返回对应文案', () => {
  const text = getConsumptionRefreshStatusText({
    isLoading: true,
    refreshSource: 'auto',
    lastRefreshedAt: null,
  })

  assert.equal(text, '正在自动刷新消费日志...')
})

test('getConsumptionRefreshStatusText 在存在最近刷新时间时返回格式化结果', () => {
  const text = getConsumptionRefreshStatusText(
    {
      isLoading: false,
      refreshSource: 'manual',
      lastRefreshedAt: '2026-03-24T06:30:00.000Z',
      lastError: null,
    },
    (value) => value.replace('T', ' ').replace('.000Z', 'Z'),
  )

  assert.equal(text, '最近刷新：2026-03-24 06:30:00Z')
})

test('getConsumptionRefreshStatusText 在尚未刷新时返回默认文案', () => {
  const text = getConsumptionRefreshStatusText({
    isLoading: false,
    refreshSource: 'initial',
    lastRefreshedAt: null,
    lastError: null,
  })

  assert.equal(text, '尚未刷新消费日志')
})

test('getConsumptionRefreshStatus 在自动刷新成功后返回成功态文案', () => {
  const status = getConsumptionRefreshStatus(
    {
      isLoading: false,
      refreshSource: 'auto',
      lastRefreshedAt: '2026-03-24T06:30:00.000Z',
      lastError: null,
    },
    (value) => value.replace('T', ' ').replace('.000Z', 'Z'),
  )

  assert.deepEqual(status, {
    tone: 'success',
    text: '自动刷新成功：2026-03-24 06:30:00Z',
  })
})

test('getConsumptionRefreshStatus 在自动刷新失败后返回错误态文案', () => {
  const status = getConsumptionRefreshStatus({
    isLoading: false,
    refreshSource: 'auto',
    lastRefreshedAt: '2026-03-24T06:30:00.000Z',
    lastError: '网络错误，请重试',
  })

  assert.deepEqual(status, {
    tone: 'error',
    text: '自动刷新失败：网络错误，请重试',
  })
})
