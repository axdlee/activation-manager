import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { DashboardStatTile } from '../src/components/dashboard-stat-tile'

test('DashboardStatTile 会渲染默认小型指标卡', () => {
  const html = renderToStaticMarkup(
    React.createElement(DashboardStatTile, {
      label: '自动登出',
      value: '3 秒',
      description: '修改成功后的安全退出窗口',
    }),
  )

  assert.match(
    html,
    /rounded-lg border border-surface-200 bg-surface-100 px-4 py-4 shadow-card/,
  )
  assert.match(html, /text-xs uppercase tracking-\[0\.18em\] text-ink-500[^>]*>自动登出</)
  assert.match(html, /text-2xl font-semibold tracking-tight text-ink-50[^>]*>3 秒</)
  assert.match(html, /修改成功后的安全退出窗口/)
})

test('DashboardStatTile 支持覆盖卡片与文本样式', () => {
  const html = renderToStaticMarkup(
    React.createElement(DashboardStatTile, {
      label: '敏感项',
      value: '4',
      description: '涉及认证与凭证配置',
      className: 'custom-tile',
      labelClassName: 'custom-label',
      valueClassName: 'custom-value',
      descriptionClassName: 'custom-description',
    }),
  )

  assert.match(html, /custom-tile/)
  assert.match(html, /custom-label/)
  assert.match(html, /custom-value/)
  assert.match(html, /custom-description/)
})
