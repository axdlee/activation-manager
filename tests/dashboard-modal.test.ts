import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { DashboardModal } from '../src/components/dashboard-modal'

test('DashboardModal 在 open=false 时不渲染任何内容', () => {
  const html = renderToStaticMarkup(
    React.createElement(DashboardModal, {
      open: false,
      title: '测试弹框',
      onClose: () => {},
      children: React.createElement('div', null, '内容'),
    }),
  )

  assert.equal(html, '')
})

test('DashboardModal 在 open=true 时渲染标题、描述、内容与关闭入口', () => {
  const html = renderToStaticMarkup(
    React.createElement(DashboardModal, {
      open: true,
      title: '测试弹框',
      description: '这是一个说明',
      onClose: () => {},
      footer: React.createElement('button', null, '保存'),
      children: React.createElement('div', null, '弹框内容'),
    }),
  )

  assert.match(html, /role="dialog"/)
  assert.match(html, /测试弹框/)
  assert.match(html, /这是一个说明/)
  assert.match(html, /弹框内容/)
  assert.match(html, /关闭弹框/)
  assert.match(html, /保存/)
})
