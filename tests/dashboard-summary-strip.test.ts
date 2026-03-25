import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { DashboardSummaryStrip } from '../src/components/dashboard-summary-strip'

test('DashboardSummaryStrip 会渲染默认容器样式与两侧内容', () => {
  const html = renderToStaticMarkup(
    React.createElement(DashboardSummaryStrip, {
      leading: React.createElement('div', { className: 'leading-slot' }, '筛选条件'),
      trailing: React.createElement('div', { className: 'trailing-slot' }, '共 20 条记录'),
    }),
  )

  assert.match(html, /leading-slot/)
  assert.match(html, /trailing-slot/)
  assert.match(html, /mb-5 rounded-\[24px\] border border-slate-200\/80 bg-slate-50\/85 px-5 py-4/)
  assert.match(html, /flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between/)
})

test('DashboardSummaryStrip 支持覆盖外层与内层样式', () => {
  const html = renderToStaticMarkup(
    React.createElement(DashboardSummaryStrip, {
      leading: '左侧',
      trailing: '右侧',
      className: 'custom-outer',
      contentClassName: 'custom-inner',
    }),
  )

  assert.match(html, /custom-outer/)
  assert.match(html, /custom-inner/)
  assert.doesNotMatch(html, /mb-5 rounded-\[24px\] border border-slate-200\/80 bg-slate-50\/85 px-5 py-4/)
})
