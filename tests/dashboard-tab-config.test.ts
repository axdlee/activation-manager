import assert from 'node:assert/strict'
import test from 'node:test'

import { dashboardTabs, getDashboardTabMeta } from '../src/lib/dashboard-tab-config'

test('dashboardTabs 按后台主工作流顺序返回标签配置', () => {
  assert.deepEqual(
    dashboardTabs.map((tab) => tab.key),
    ['stats', 'projects', 'generate', 'list', 'consumptions', 'apiDocs', 'changePassword', 'systemConfig'],
  )
})

test('getDashboardTabMeta 会返回当前标签的标题与说明', () => {
  assert.deepEqual(getDashboardTabMeta('apiDocs'), {
    key: 'apiDocs',
    label: 'API 接入',
    shortLabel: 'API',
    description: '集中查看正式接口、调研路径与多语言调用示例。',
  })
})
