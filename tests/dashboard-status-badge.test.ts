import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { DashboardStatusBadge } from '../src/components/dashboard-status-badge'

test('DashboardStatusBadge 会按 tone 渲染统一徽标样式', () => {
  const html = renderToStaticMarkup(
    React.createElement(DashboardStatusBadge, {
      label: '启用中',
      tone: 'success',
    }),
  )

  assert.match(html, /启用中/)
  assert.match(html, /inline-flex items-center rounded-full bg-emerald-100 px-2\.5 py-1 text-xs font-medium text-emerald-700/)
})

test('DashboardStatusBadge 支持自定义 className 覆盖默认 tone 样式', () => {
  const html = renderToStaticMarkup(
    React.createElement(DashboardStatusBadge, {
      label: '未激活',
      tone: 'info',
      className: 'custom-badge',
    }),
  )

  assert.match(html, /custom-badge/)
  assert.doesNotMatch(html, /bg-sky-100 text-sky-700/)
})
