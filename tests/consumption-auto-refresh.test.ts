import assert from 'node:assert/strict'
import test from 'node:test'

import { buildConsumptionAutoRefreshKey } from '../src/lib/consumption-auto-refresh'

test('buildConsumptionAutoRefreshKey 会对关键字做 trim，等价筛选生成相同 key', () => {
  const firstKey = buildConsumptionAutoRefreshKey({
    projectKey: 'all',
    keyword: ' req-001 ',
    createdFrom: '',
    createdTo: '',
  })
  const secondKey = buildConsumptionAutoRefreshKey({
    projectKey: 'all',
    keyword: 'req-001',
    createdFrom: '',
    createdTo: '',
  })

  assert.equal(firstKey, secondKey)
})

test('buildConsumptionAutoRefreshKey 会区分不同筛选条件', () => {
  const firstKey = buildConsumptionAutoRefreshKey({
    projectKey: 'browser-plugin',
    keyword: 'req-001',
    createdFrom: '2026-03-24T00:00',
    createdTo: '',
  })
  const secondKey = buildConsumptionAutoRefreshKey({
    projectKey: 'default',
    keyword: 'req-001',
    createdFrom: '2026-03-24T00:00',
    createdTo: '',
  })

  assert.notEqual(firstKey, secondKey)
})
