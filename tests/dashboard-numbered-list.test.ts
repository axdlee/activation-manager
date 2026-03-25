import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { DashboardNumberedList } from '../src/components/dashboard-numbered-list'

test('DashboardNumberedList 会渲染默认编号卡片列表', () => {
  const html = renderToStaticMarkup(
    React.createElement(DashboardNumberedList, {
      items: ['修改后会立即登出旧会话', 'JWT 密钥变更后需要重新登录'],
    }),
  )

  assert.match(html, /space-y-3/)
  assert.match(
    html,
    /flex items-start gap-3 rounded-\[22px\] border border-white\/80 bg-white\/80 px-4 py-4 text-sm leading-7 text-slate-600 shadow-sm/,
  )
  assert.match(
    html,
    /flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-xs font-semibold text-white shadow-sm[^>]*>01</,
  )
  assert.match(html, />02</)
  assert.match(html, /修改后会立即登出旧会话/)
  assert.match(html, /JWT 密钥变更后需要重新登录/)
})

test('DashboardNumberedList 支持覆盖容器、条目与编号渲染', () => {
  const html = renderToStaticMarkup(
    React.createElement(DashboardNumberedList, {
      items: ['第一项'],
      className: 'custom-stack',
      itemClassName: 'custom-item',
      indexClassName: 'custom-index',
      contentClassName: 'custom-content',
      renderIndex: (index) => `#${index + 1}`,
    }),
  )

  assert.match(html, /custom-stack/)
  assert.match(html, /custom-item/)
  assert.match(html, /custom-index/)
  assert.match(html, /custom-content/)
  assert.match(html, />#1</)
})
