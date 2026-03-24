import assert from 'node:assert/strict'
import test from 'node:test'

import { filterProjectStatsByProjectKey } from '../src/lib/project-stats-filter'

const projectStats = [
  {
    id: 1,
    name: '默认项目',
    projectKey: 'default',
    isEnabled: true,
    totalCodes: 100,
    usedCodes: 0,
    expiredCodes: 0,
    activeCodes: 100,
    countRemainingTotal: 0,
    countConsumedTotal: 0,
  },
  {
    id: 2,
    name: '浏览器插件',
    projectKey: 'browser-plugin',
    isEnabled: true,
    totalCodes: 2,
    usedCodes: 2,
    expiredCodes: 0,
    activeCodes: 1,
    countRemainingTotal: 5,
    countConsumedTotal: 3,
  },
]

test('filterProjectStatsByProjectKey 在 all 下返回全部项目统计', () => {
  const filtered = filterProjectStatsByProjectKey(projectStats, 'all')

  assert.equal(filtered.length, 2)
  assert.equal(filtered[0].projectKey, 'default')
  assert.equal(filtered[1].projectKey, 'browser-plugin')
})

test('filterProjectStatsByProjectKey 可按项目标识过滤项目统计', () => {
  const filtered = filterProjectStatsByProjectKey(projectStats, 'browser-plugin')

  assert.equal(filtered.length, 1)
  assert.equal(filtered[0].projectKey, 'browser-plugin')
  assert.equal(filtered[0].countConsumedTotal, 3)
})
