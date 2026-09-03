import assert from 'node:assert/strict'
import test from 'node:test'

import { buildProjectStatsInsights } from '../src/lib/project-stats-insights'

test('buildProjectStatsInsights 会计算次数使用率并找出峰值消费项目', () => {
  const insights = buildProjectStatsInsights([
    {
      name: '浏览器插件',
      projectKey: 'browser-plugin',
      countRemainingTotal: 8,
      countConsumedTotal: 12,
    },
    {
      name: '桌面助手',
      projectKey: 'desktop-helper',
      countRemainingTotal: 5,
      countConsumedTotal: 5,
    },
  ])

  assert.deepEqual(insights, {
    totalCountCapacity: 30,
    countUsageRate: 56.7,
    peakConsumptionProject: {
      name: '浏览器插件',
      projectKey: 'browser-plugin',
      countConsumedTotal: 12,
    },
  })
})

test('buildProjectStatsInsights 在没有次数型容量或消费时返回 0 使用率和空峰值项目', () => {
  const insights = buildProjectStatsInsights([
    {
      name: '默认项目',
      projectKey: 'default',
      countRemainingTotal: 0,
      countConsumedTotal: 0,
    },
  ])

  assert.deepEqual(insights, {
    totalCountCapacity: 0,
    countUsageRate: 0,
    peakConsumptionProject: null,
  })
})
