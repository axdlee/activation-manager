import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { WorkspaceTabNav } from '../src/components/workspace-tab-nav'

test('WorkspaceTabNav 会渲染所有 tab 文案并高亮当前激活项', () => {
  const html = renderToStaticMarkup(
    React.createElement(WorkspaceTabNav, {
      tabs: [
        {
          key: 'manage',
          label: '项目列表',
          shortLabel: '列表',
          description: '筛选、分页并维护已有项目',
        },
        {
          key: 'create',
          label: '新建项目',
          shortLabel: '新建',
          description: '创建新的项目名称、标识与描述',
        },
      ],
      activeTab: 'create',
      onChange: () => undefined,
      badgeTextClassName: 'text-sm',
    }),
  )

  assert.match(html, /项目列表/)
  assert.match(html, /新建项目/)
  assert.match(html, /创建新的项目名称、标识与描述/)
  assert.match(html, /border-sky-200 bg-sky-50\/85/)
  assert.match(html, /bg-sky-600 text-white/)
  assert.match(html, /text-sm/)
})

test('WorkspaceTabNav 会为非激活项保留默认卡片样式', () => {
  const html = renderToStaticMarkup(
    React.createElement(WorkspaceTabNav, {
      tabs: [
        {
          key: 'logs',
          label: '日志列表',
          shortLabel: '日志',
          description: '聚焦查看分页记录、导出结果与刷新状态',
        },
        {
          key: 'filters',
          label: '筛选与刷新',
          shortLabel: '筛选',
          description: '集中设置项目、时间范围与自动刷新条件',
        },
      ],
      activeTab: 'logs',
      onChange: () => undefined,
    }),
  )

  assert.match(html, /border-white\/70 bg-white\/75/)
  assert.match(html, /bg-slate-900 text-white\/90/)
  assert.match(html, /筛选与刷新/)
})
