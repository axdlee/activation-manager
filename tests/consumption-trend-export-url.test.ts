import assert from 'node:assert/strict'
import test from 'node:test'

import { buildConsumptionTrendExportUrl } from '../src/lib/consumption-trend-export-url'

test('buildConsumptionTrendExportUrl 会在双项目对比导出时带上 compareProjectKey 与非零桶参数', () => {
  const exportUrl = buildConsumptionTrendExportUrl({
    days: 30,
    granularity: 'week',
    projectKey: 'browser-plugin',
    compareProjectKey: 'desktop-helper',
    hideZeroBuckets: true,
  })

  assert.equal(
    exportUrl,
    '/api/admin/consumptions/trend/export?days=30&granularity=week&projectKey=browser-plugin&compareProjectKey=desktop-helper&hideZeroBuckets=true',
  )
})

test('buildConsumptionTrendExportUrl 会忽略无效的对比项目参数', () => {
  const exportUrl = buildConsumptionTrendExportUrl({
    days: 7,
    granularity: 'day',
    projectKey: 'browser-plugin',
    compareProjectKey: 'browser-plugin',
    hideZeroBuckets: false,
  })

  assert.equal(
    exportUrl,
    '/api/admin/consumptions/trend/export?days=7&granularity=day&projectKey=browser-plugin',
  )
})
