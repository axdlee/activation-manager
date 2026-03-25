import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { DashboardTableContainer } from '../src/components/dashboard-table-container'

test('DashboardTableContainer 会渲染默认表格容器样式与子节点', () => {
  const html = renderToStaticMarkup(
    React.createElement(
      DashboardTableContainer,
      null,
      React.createElement('table', { className: 'table-slot' }, React.createElement('tbody', null)),
    ),
  )

  assert.match(html, /table-slot/)
  assert.match(html, /overflow-x-auto rounded-\[24px\] border border-slate-200\/80 bg-white\/95 shadow-\[0_18px_56px_-42px_rgba\(15,23,42,0\.22\)\]/)
})

test('DashboardTableContainer 支持覆盖外层 className', () => {
  const html = renderToStaticMarkup(
    React.createElement(
      DashboardTableContainer,
      { className: 'custom-table-shell' },
      React.createElement('div', null, 'content'),
    ),
  )

  assert.match(html, /custom-table-shell/)
})
