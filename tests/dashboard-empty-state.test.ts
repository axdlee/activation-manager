import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { DashboardEmptyState } from '../src/components/dashboard-empty-state'

test('DashboardEmptyState 会渲染默认空状态样式与文案', () => {
  const html = renderToStaticMarkup(
    React.createElement(DashboardEmptyState, {
      message: '暂无匹配的激活码记录',
    }),
  )

  assert.match(html, /暂无匹配的激活码记录/)
  assert.match(html, /rounded-\[24px\] border border-dashed border-slate-200 bg-slate-50\/75 px-6 py-10 text-center text-sm text-slate-500/)
})

test('DashboardEmptyState 支持追加自定义 className', () => {
  const html = renderToStaticMarkup(
    React.createElement(DashboardEmptyState, {
      message: '暂无匹配的消费日志',
      className: 'mt-5 custom-empty-state',
    }),
  )

  assert.match(html, /mt-5 custom-empty-state/)
  assert.match(html, /暂无匹配的消费日志/)
})
