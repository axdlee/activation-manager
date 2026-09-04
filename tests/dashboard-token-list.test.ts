import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { DashboardTokenList } from '../src/components/dashboard-token-list'

test('DashboardTokenList 会渲染全部 token 并使用默认布局样式', () => {
  const html = renderToStaticMarkup(
    React.createElement(DashboardTokenList, {
      tokens: ['项目：浏览器插件', '状态：已绑定'],
      emptyText: '当前未设置任何筛选条件',
    }),
  )

  assert.match(html, /项目：浏览器插件/)
  assert.match(html, /状态：已绑定/)
  assert.match(html, /flex flex-wrap gap-2/)
  assert.match(html, /rounded-full border border-brand-500\/20 bg-brand-500\/100\/10 px-3 py-1\.5 text-sm text-brand-400/)
})

test('DashboardTokenList 在没有 token 时会渲染空状态文案', () => {
  const html = renderToStaticMarkup(
    React.createElement(DashboardTokenList, {
      tokens: [],
      emptyText: '当前显示全部激活码',
    }),
  )

  assert.match(html, /当前显示全部激活码/)
  assert.match(html, /rounded-full border border-surface-200 bg-surface-100 px-3 py-1.5 text-sm text-ink-500/)
})

test('DashboardTokenList 支持覆盖容器、token 与空状态样式', () => {
  const htmlWithTokens = renderToStaticMarkup(
    React.createElement(DashboardTokenList, {
      tokens: ['自动刷新已开启'],
      emptyText: '空状态',
      className: 'custom-container',
      tokenClassName: 'custom-token',
    }),
  )

  const htmlWithoutTokens = renderToStaticMarkup(
    React.createElement(DashboardTokenList, {
      tokens: [],
      emptyText: '空状态',
      emptyClassName: 'custom-empty',
    }),
  )

  assert.match(htmlWithTokens, /custom-container/)
  assert.match(htmlWithTokens, /custom-token/)
  assert.match(htmlWithoutTokens, /custom-empty/)
})
