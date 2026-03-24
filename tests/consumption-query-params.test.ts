import assert from 'node:assert/strict'
import test from 'node:test'

import { buildConsumptionQueryParams } from '../src/lib/consumption-query-params'

test('buildConsumptionQueryParams 会忽略空筛选条件', () => {
  const params = buildConsumptionQueryParams({
    projectKey: 'all',
    keyword: '   ',
    createdFrom: '',
    createdTo: '',
  })

  assert.equal(params.toString(), '')
})

test('buildConsumptionQueryParams 会构造项目、关键字与时间范围参数', () => {
  const params = buildConsumptionQueryParams({
    projectKey: 'browser-plugin',
    keyword: ' req-001 ',
    createdFrom: '2026-03-24T00:00',
    createdTo: '2026-03-24T23:59',
  })

  assert.equal(params.get('projectKey'), 'browser-plugin')
  assert.equal(params.get('keyword'), 'req-001')
  assert.equal(new Date(params.get('createdFrom') || '').getTime(), new Date('2026-03-24T00:00').getTime())
  assert.equal(new Date(params.get('createdTo') || '').getTime(), new Date('2026-03-24T23:59').getTime())
})
