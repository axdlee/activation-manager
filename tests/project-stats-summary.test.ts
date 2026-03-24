import assert from 'node:assert/strict'
import test from 'node:test'

import { summarizeProjectStats } from '../src/lib/project-stats-summary'

const projectStats = [
  {
    id: 1,
    name: '默认项目',
    projectKey: 'default',
    isEnabled: true,
    totalCodes: 100,
    usedCodes: 20,
    expiredCodes: 5,
    activeCodes: 75,
    countRemainingTotal: 30,
    countConsumedTotal: 10,
  },
  {
    id: 2,
    name: '浏览器插件',
    projectKey: 'browser-plugin',
    isEnabled: true,
    totalCodes: 6,
    usedCodes: 4,
    expiredCodes: 1,
    activeCodes: 2,
    countRemainingTotal: 8,
    countConsumedTotal: 12,
  },
]

test('summarizeProjectStats 会汇总项目统计为顶部卡片所需数据', () => {
  const summary = summarizeProjectStats(projectStats)

  assert.deepEqual(summary, {
    total: 106,
    used: 24,
    expired: 6,
    active: 77,
    countRemainingTotal: 38,
    countConsumedTotal: 22,
  })
})

test('summarizeProjectStats 在空数组时返回全 0 统计', () => {
  const summary = summarizeProjectStats([])

  assert.deepEqual(summary, {
    total: 0,
    used: 0,
    expired: 0,
    active: 0,
    countRemainingTotal: 0,
    countConsumedTotal: 0,
  })
})
