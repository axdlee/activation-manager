import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { DashboardDataTable } from '../src/components/dashboard-data-table'

test('DashboardDataTable 会渲染默认表格容器、表头与 tbody 内容', () => {
  const html = renderToStaticMarkup(
    React.createElement(
      DashboardDataTable,
      {
        headers: ['项目', '激活码', '状态'],
      },
      React.createElement(
        'tr',
        { className: 'row-slot' },
        React.createElement('td', null, 'A 项目'),
      ),
    ),
  )

  assert.match(html, /项目/)
  assert.match(html, /激活码/)
  assert.match(html, /状态/)
  assert.match(html, /row-slot/)
  assert.match(
    html,
    /dashboard-scroll-area overflow-x-auto overflow-y-hidden touch-pan-x rounded-\[24px\] border border-slate-200\/80 bg-white\/95 shadow-\[0_18px_56px_-42px_rgba\(15,23,42,0\.22\)\] cursor-grab/u,
  )
  assert.match(html, /w-full min-w-max divide-y divide-gray-200/)
  assert.match(html, /bg-slate-50\/90/)
  assert.match(html, /divide-y divide-gray-200 bg-white/)
  assert.match(
    html,
    /whitespace-nowrap px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider/u,
  )
  assert.match(html, /列较多时可左右拖动、Shift \+ 滚轮或拖动滚动条查看完整内容/)
})

test('DashboardDataTable 支持覆盖容器、table、thead、tbody 与 th 样式', () => {
  const html = renderToStaticMarkup(
    React.createElement(
      DashboardDataTable,
      {
        headers: ['项目'],
        containerClassName: 'custom-shell',
        tableClassName: 'custom-table',
        headClassName: 'custom-head',
        bodyClassName: 'custom-body',
        headerCellClassName: 'custom-header-cell',
      },
      React.createElement('tr', null, React.createElement('td', null, 'A')),
    ),
  )

  assert.match(html, /custom-shell/)
  assert.match(html, /custom-table/)
  assert.match(html, /custom-head/)
  assert.match(html, /custom-body/)
  assert.match(html, /custom-header-cell/)
})
