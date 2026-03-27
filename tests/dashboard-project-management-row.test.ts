import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { DashboardProjectManagementRow } from '../src/components/dashboard-project-management-row'

test('DashboardProjectManagementRow 会渲染默认项目的只读字段、策略摘要与受限操作', () => {
  const html = renderToStaticMarkup(
    React.createElement(DashboardProjectManagementRow, {
      project: {
        id: 1,
        name: '默认项目',
        description: '系统默认项目',
        projectKey: 'default',
        isEnabled: true,
      },
      policySummary: ['自助换绑：继承系统配置', '冷却时间：继承上级', '次数上限：继承上级'],
      loading: false,
      onCopyProjectKey: () => {},
      onEditBasics: () => {},
      onEditRebind: () => {},
      onToggleStatus: () => {},
      onDelete: () => {},
    }),
  )

  assert.match(html, /<tr class="transition hover:bg-slate-50\/80">/)
  assert.match(html, /默认项目/)
  assert.match(html, /系统默认项目/)
  assert.match(html, /默认项目不可停用，也不可删除。/)
  assert.match(html, /自助换绑：继承系统配置/)
  assert.match(html, /冷却时间：继承上级/)
  assert.match(html, /次数上限：继承上级/)
  assert.match(html, /复制标识/)
  assert.match(html, /编辑基础信息/)
  assert.match(html, /编辑换绑策略/)
  assert.match(html, /停用/)
  assert.match(html, /启用中/)
  assert.doesNotMatch(html, />删除</)
})

test('DashboardProjectManagementRow 会渲染普通项目的策略摘要与完整操作入口', () => {
  const html = renderToStaticMarkup(
    React.createElement(DashboardProjectManagementRow, {
      project: {
        id: 2,
        name: '浏览器插件项目',
        description: '浏览器插件授权',
        projectKey: 'browser-plugin',
        isEnabled: false,
      },
      policySummary: ['自助换绑：允许自助换绑', '冷却时间：3 小时', '次数上限：2 次'],
      loading: false,
      onCopyProjectKey: () => {},
      onEditBasics: () => {},
      onEditRebind: () => {},
      onToggleStatus: () => {},
      onDelete: () => {},
    }),
  )

  assert.match(html, /浏览器插件项目/)
  assert.match(html, /浏览器插件授权/)
  assert.match(html, /browser-plugin/)
  assert.match(html, /用于 API 接入、发码隔离与筛选。/)
  assert.match(html, /自助换绑：允许自助换绑/)
  assert.match(html, /冷却时间：3 小时/)
  assert.match(html, /次数上限：2 次/)
  assert.match(html, /复制标识/)
  assert.match(html, /编辑基础信息/)
  assert.match(html, /编辑换绑策略/)
  assert.match(html, /启用/)
  assert.match(html, /删除/)
  assert.match(html, /已停用/)
})
