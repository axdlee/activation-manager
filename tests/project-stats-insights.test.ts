import assert from 'node:assert/strict'
import test from 'node:test'

import { buildProjectStatsInsights } from '../src/lib/project-stats-insights'

test('buildProjectStatsInsights 会计算次数使用率并找出峰值消费项目', () => {
  const insights = buildProjectStatsInsights([
    {
      id: 1,
      name: '浏览器插件',
      projectKey: 'browser-plugin',
      isEnabled: true,
      totalCodes: 3,
      usedCodes: 2,
      expiredCodes: 0,
      activeCodes: 1,
      countRemainingTotal: 8,
      countConsumedTotal: 12,
    },
    {
      id: 2,
      name: '桌面助手',
      projectKey: 'desktop-helper',
      isEnabled: true,
      totalCodes: 2,
      usedCodes: 1,
      expiredCodes: 0,
      activeCodes: 1,
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
  ])

  assert.deepEqual(insights, {
    totalCountCapacity: 0,
    countUsageRate: 0,
    peakConsumptionProject: null,
  })
})
