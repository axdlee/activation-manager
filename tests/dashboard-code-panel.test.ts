import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { DashboardCodePanel } from '../src/components/dashboard-code-panel'

test('DashboardCodePanel 会渲染默认代码展示面板结构', () => {
  const html = renderToStaticMarkup(
    React.createElement(DashboardCodePanel, {
      header: React.createElement('div', { className: 'header-slot' }, '请求示例'),
      code: 'curl -X POST https://example.com/api/license/activate',
    }),
  )

  assert.match(
    html,
    /rounded-\[24px\] border border-slate-200\/80 bg-white\/92 p-5 shadow-\[0_18px_56px_-42px_rgba\(15,23,42,0\.22\)\]/,
  )
  assert.match(
    html,
    /mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between/,
  )
  assert.match(html, /header-slot/)
  assert.match(
    html,
    /overflow-x-auto rounded-\[22px\] border border-slate-200\/80 bg-slate-950 px-4 py-4 font-mono text-\[12px\] leading-6 text-slate-100 shadow-\[0_18px_56px_-42px_rgba\(15,23,42,0\.55\)\]/,
  )
  assert.match(html, /curl -X POST https:\/\/example\.com\/api\/license\/activate/)
})

test('DashboardCodePanel 支持覆盖面板、头部、内容区与操作区样式', () => {
  const html = renderToStaticMarkup(
    React.createElement(DashboardCodePanel, {
      header: React.createElement('div', { className: 'custom-header-slot' }, '示例代码'),
      code: '{"ok":true}',
      action: React.createElement('button', { className: 'copy-slot' }, '复制'),
      panelClassName: 'custom-panel',
      headerClassName: 'custom-header-layout',
      headerContentClassName: 'custom-header-content',
      codeClassName: 'custom-code-block',
      className: 'custom-extra-shell',
    }),
  )

  assert.match(html, /custom-panel/)
  assert.match(html, /custom-header-layout/)
  assert.match(html, /custom-header-content/)
  assert.match(html, /custom-code-block/)
  assert.match(html, /custom-extra-shell/)
  assert.match(html, /copy-slot/)
  assert.match(html, /custom-header-slot/)
})
