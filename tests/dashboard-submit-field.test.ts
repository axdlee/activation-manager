import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { DashboardSubmitField } from '../src/components/dashboard-submit-field'

test('DashboardSubmitField 会渲染默认提交槽并在 loading 时禁用按钮', () => {
  const html = renderToStaticMarkup(
    React.createElement(DashboardSubmitField, {
      idleText: '生成时间型激活码',
      loadingText: '生成中...',
      loading: true,
      buttonClassName: 'primary-button',
    }),
  )

  assert.match(html, /flex items-end/)
  assert.match(html, /type="submit"/)
  assert.match(html, /disabled=""/)
  assert.match(html, /生成中\.\.\./)
  assert.match(html, /w-full primary-button/)
})

test('DashboardSubmitField 支持自定义容器样式、按钮类型与禁用状态', () => {
  const html = renderToStaticMarkup(
    React.createElement(DashboardSubmitField, {
      idleText: '生成次数型激活码',
      loadingText: '生成中...',
      disabled: true,
      type: 'button',
      className: 'custom-submit-shell',
      buttonClassName: 'custom-submit-button',
    }),
  )

  assert.match(html, /custom-submit-shell/)
  assert.match(html, /custom-submit-button/)
  assert.match(html, /type="button"/)
  assert.match(html, /disabled=""/)
  assert.match(html, /生成次数型激活码/)
})
