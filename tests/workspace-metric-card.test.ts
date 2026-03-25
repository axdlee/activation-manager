import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { WorkspaceMetricCard } from '../src/components/workspace-metric-card'

test('WorkspaceMetricCard 会渲染标签、数值与描述', () => {
  const html = renderToStaticMarkup(
    React.createElement(WorkspaceMetricCard, {
      label: '风险项',
      value: 12,
      description: '已过期或已耗尽的记录',
    }),
  )

  assert.match(html, /风险项/)
  assert.match(html, />12</)
  assert.match(html, /已过期或已耗尽的记录/)
  assert.match(html, /rounded-\[22px\]/)
})

test('WorkspaceMetricCard 支持覆盖外层 className', () => {
  const html = renderToStaticMarkup(
    React.createElement(WorkspaceMetricCard, {
      label: '匹配日志',
      value: '36',
      description: '当前条件下的消费记录数',
      className: 'custom-metric-card',
    }),
  )

  assert.match(html, /custom-metric-card/)
  assert.doesNotMatch(html, /rounded-\[22px\]/)
})
