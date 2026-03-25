import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { DashboardSectionHeader } from '../src/components/dashboard-section-header'

test('DashboardSectionHeader 会渲染标题、描述与默认布局样式', () => {
  const html = renderToStaticMarkup(
    React.createElement(DashboardSectionHeader, {
      title: '筛选与导出',
      description: '统一维护搜索项、状态、项目与套餐条件。',
    }),
  )

  assert.match(html, /筛选与导出/)
  assert.match(html, /统一维护搜索项、状态、项目与套餐条件/)
  assert.match(html, /mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between/)
  assert.match(html, /text-xl font-semibold text-slate-900/)
  assert.match(html, /text-sm leading-6 text-slate-500/)
})

test('DashboardSectionHeader 会渲染 trailing 区域', () => {
  const html = renderToStaticMarkup(
    React.createElement(DashboardSectionHeader, {
      title: '项目列表',
      description: '维护已有项目。',
      trailing: React.createElement('div', { className: 'trailing-slot' }, '默认项目名称固定，且不可停用'),
    }),
  )

  assert.match(html, /trailing-slot/)
  assert.match(html, /默认项目名称固定，且不可停用/)
})

test('DashboardSectionHeader 支持自定义 className 覆盖默认布局', () => {
  const html = renderToStaticMarkup(
    React.createElement(DashboardSectionHeader, {
      title: '新建项目',
      description: '创建独立 projectKey。',
      className: 'custom-layout',
    }),
  )

  assert.match(html, /custom-layout/)
  assert.doesNotMatch(html, /mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between/)
})
