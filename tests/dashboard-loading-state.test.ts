import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { DashboardLoadingState } from '../src/components/dashboard-loading-state'

test('DashboardLoadingState 会渲染默认加载态容器、旋转指示器与文案', () => {
  const html = renderToStaticMarkup(
    React.createElement(DashboardLoadingState, {
      message: '消费趋势加载中...',
    }),
  )

  assert.match(html, /消费趋势加载中/)
  assert.match(html, /py-10 text-center/)
  assert.match(html, /inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600/)
  assert.match(html, /mt-2 text-slate-600/)
})

test('DashboardLoadingState 支持追加自定义 className', () => {
  const html = renderToStaticMarkup(
    React.createElement(DashboardLoadingState, {
      message: '加载中...',
      className: 'custom-loading-shell',
    }),
  )

  assert.match(html, /custom-loading-shell/)
})
