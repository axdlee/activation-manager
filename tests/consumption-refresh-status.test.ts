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

test('getConsumptionRefreshStatus 在 quick 刷新失败时返回对应错误文案', () => {
  const status = getConsumptionRefreshStatus({
    isLoading: false,
    refreshSource: 'quick',
    lastRefreshedAt: null,
    lastError: '请求超时',
  })

  assert.equal(status.tone, 'error')
  assert.equal(status.text, '时间范围刷新失败：请求超时')
})

test('getConsumptionRefreshStatus 在 initial 加载失败时返回对应错误文案', () => {
  const status = getConsumptionRefreshStatus({
    isLoading: false,
    refreshSource: 'initial',
    lastRefreshedAt: null,
    lastError: '网络错误',
  })

  assert.equal(status.tone, 'error')
  assert.equal(status.text, '加载消费日志失败：网络错误')
})

test('getConsumptionRefreshStatus 在 manual 刷新失败时返回通用错误文案', () => {
  const status = getConsumptionRefreshStatus({
    isLoading: false,
    refreshSource: 'manual',
    lastRefreshedAt: null,
    lastError: '500',
  })

  assert.equal(status.tone, 'error')
  assert.equal(status.text, '刷新消费日志失败：500')
})

test('getConsumptionRefreshStatus 在 manual 刷新成功时返回最近刷新文案', () => {
  const status = getConsumptionRefreshStatus(
    {
      isLoading: false,
      refreshSource: 'manual',
      lastRefreshedAt: '2026-03-24T06:30:00.000Z',
      lastError: null,
    },
    () => '格式化时间',
  )

  assert.equal(status.tone, 'success')
  assert.equal(status.text, '最近刷新：格式化时间')
})

test('getConsumptionRefreshStatus 在 initial 加载成功时返回已加载文案', () => {
  const status = getConsumptionRefreshStatus(
    {
      isLoading: false,
      refreshSource: 'initial',
      lastRefreshedAt: '2026-03-24T06:30:00.000Z',
      lastError: null,
    },
    () => '时间',
  )

  assert.equal(status.tone, 'success')
  assert.equal(status.text, '消费日志已加载：时间')
})

test('getConsumptionRefreshStatus 在 quick 刷新成功时返回时间范围已更新文案', () => {
  const status = getConsumptionRefreshStatus(
    {
      isLoading: false,
      refreshSource: 'quick',
      lastRefreshedAt: '2026-03-24T06:30:00.000Z',
      lastError: null,
    },
    () => '时间',
  )

  assert.equal(status.tone, 'success')
  assert.equal(status.text, '时间范围已更新：时间')
})

test('getConsumptionRefreshStatus 在 quick 刷新中返回对应加载文案', () => {
  const status = getConsumptionRefreshStatus({
    isLoading: true,
    refreshSource: 'quick',
    lastRefreshedAt: null,
  })

  assert.equal(status.tone, 'info')
  assert.equal(status.text, '正在应用时间范围并刷新消费日志...')
})

test('getConsumptionRefreshStatus 在 initial 刷新中返回对应加载文案', () => {
  const status = getConsumptionRefreshStatus({
    isLoading: true,
    refreshSource: 'initial',
    lastRefreshedAt: null,
  })

  assert.equal(status.tone, 'info')
  assert.equal(status.text, '正在加载消费日志...')
})

test('getConsumptionRefreshStatus 在 manual 刷新中返回通用加载文案', () => {
  const status = getConsumptionRefreshStatus({
    isLoading: true,
    refreshSource: 'manual',
    lastRefreshedAt: null,
  })

  assert.equal(status.tone, 'info')
  assert.equal(status.text, '正在刷新消费日志...')
})
