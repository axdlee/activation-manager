import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { DashboardFormField } from '../src/components/dashboard-form-field'

test('DashboardFormField 会渲染默认标题样式、描述与内容区', () => {
  const html = renderToStaticMarkup(
    React.createElement(
      DashboardFormField,
      {
        label: '授权类型',
        description: '选择时间型或次数型。',
        htmlFor: 'license-mode',
      },
      React.createElement('select', { id: 'license-mode', className: 'control-slot' }),
    ),
  )

  assert.match(html, /授权类型/)
  assert.match(html, /选择时间型或次数型/)
  assert.match(html, /for="license-mode"/)
  assert.match(html, /mb-2 block text-sm font-medium text-slate-700/)
  assert.match(html, /mt-1 text-sm leading-6 text-slate-500/)
  assert.match(html, /control-slot/)
})

test('DashboardFormField 支持覆盖容器、label 与内容区样式', () => {
  const html = renderToStaticMarkup(
    React.createElement(
      DashboardFormField,
      {
        label: '生成数量',
        className: 'custom-shell',
        labelClassName: 'custom-label',
        bodyClassName: 'custom-body',
      },
      React.createElement('input', { className: 'field-slot' }),
    ),
  )

  assert.match(html, /custom-shell/)
  assert.match(html, /custom-label/)
  assert.match(html, /custom-body/)
  assert.match(html, /field-slot/)
})
