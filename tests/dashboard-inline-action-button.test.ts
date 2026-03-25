import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { DashboardInlineActionButton } from '../src/components/dashboard-inline-action-button'

test('DashboardInlineActionButton 会渲染默认按钮样式并默认 type=button', () => {
  const html = renderToStaticMarkup(
    React.createElement(DashboardInlineActionButton, null, '复制'),
  )

  assert.match(html, /复制/)
  assert.match(html, /type="button"/)
  assert.match(html, /rounded-full border border-slate-200 bg-white px-3 py-1\.5 text-xs font-medium text-slate-600 shadow-sm transition hover:-translate-y-0\.5 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50/)
})

test('DashboardInlineActionButton 支持透传 disabled 与自定义 className', () => {
  const html = renderToStaticMarkup(
    React.createElement(DashboardInlineActionButton, {
      disabled: true,
      className: 'custom-inline-action',
    }, '删除'),
  )

  assert.match(html, /disabled=""/)
  assert.match(html, /custom-inline-action/)
})
