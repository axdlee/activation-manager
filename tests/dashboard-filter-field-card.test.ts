import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { DashboardFilterFieldCard } from '../src/components/dashboard-filter-field-card'

test('DashboardFilterFieldCard 会渲染默认卡片样式、标题、描述与内容区', () => {
  const html = renderToStaticMarkup(
    React.createElement(
      DashboardFilterFieldCard,
      {
        label: '项目筛选',
        description: '只看某一个项目时，更容易判断扣次波动。',
        htmlFor: 'project-filter',
      },
      React.createElement('select', { id: 'project-filter', className: 'control-slot' }),
    ),
  )

  assert.match(html, /项目筛选/)
  assert.match(html, /只看某一个项目时，更容易判断扣次波动/)
  assert.match(html, /for="project-filter"/)
  assert.match(html, /control-slot/)
  assert.match(html, /rounded-\[24px\] border border-slate-200\/80 bg-white\/88 p-5 shadow-\[0_18px_56px_-42px_rgba\(15,23,42,0\.28\)\]/)
  assert.match(html, /mt-4/)
})

test('DashboardFilterFieldCard 支持覆盖卡片与内容区样式', () => {
  const html = renderToStaticMarkup(
    React.createElement(
      DashboardFilterFieldCard,
      {
        label: '导出当前结果',
        description: '导出 CSV。',
        className: 'custom-shell',
        bodyClassName: 'custom-body',
      },
      React.createElement('button', { className: 'button-slot' }, '导出'),
    ),
  )

  assert.match(html, /custom-shell/)
  assert.match(html, /custom-body/)
  assert.match(html, /button-slot/)
  assert.doesNotMatch(html, /rounded-\[24px\] border border-slate-200\/80 bg-white\/88 p-5 shadow-\[0_18px_56px_-42px_rgba\(15,23,42,0\.28\)\]/)
  assert.doesNotMatch(html, /mt-4/)
})
