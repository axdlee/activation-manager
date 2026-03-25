import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { DashboardSummaryCard } from '../src/components/dashboard-summary-card'

test('DashboardSummaryCard 会渲染统一摘要卡结构与默认样式', () => {
  const html = renderToStaticMarkup(
    React.createElement(DashboardSummaryCard, {
      label: '配置项',
      value: '8',
      description: '当前系统共有 8 个可管理配置项。',
    }),
  )

  assert.match(
    html,
    /relative overflow-hidden rounded-\[24px\] border px-5 py-5 shadow-\[0_18px_56px_-42px_rgba\(15,23,42,0\.3\)\]/,
  )
  assert.match(html, /absolute inset-x-5 top-0 h-1 rounded-full bg-slate-900/)
  assert.match(html, /text-xs uppercase tracking-\[0\.18em\] text-slate-500[^>]*>配置项</)
  assert.match(html, /text-3xl font-semibold tracking-tight text-slate-900[^>]*>8</)
  assert.match(html, /当前系统共有 8 个可管理配置项/) 
})

test('DashboardSummaryCard 支持覆盖面板、强调线和值样式', () => {
  const html = renderToStaticMarkup(
    React.createElement(DashboardSummaryCard, {
      label: '安全状态',
      value: '良好',
      description: '当前密码策略达到建议基线。',
      panelClassName: 'custom-panel border-emerald-200 bg-emerald-50',
      accentClassName: 'custom-accent bg-emerald-500',
      valueClassName: 'custom-value text-emerald-900',
      className: 'hover:-translate-y-0.5',
    }),
  )

  assert.match(html, /custom-panel/)
  assert.match(html, /custom-accent/)
  assert.match(html, /custom-value/)
  assert.match(html, /hover:-translate-y-0\.5/)
})
