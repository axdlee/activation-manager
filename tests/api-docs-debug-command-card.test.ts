import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { ApiDocsDebugCommandCard } from '../src/components/api-docs-debug-command-card'

test('ApiDocsDebugCommandCard 会渲染联调命令卡与默认复制按钮', () => {
  const html = renderToStaticMarkup(
    React.createElement(ApiDocsDebugCommandCard, {
      title: '自动化烟雾测试',
      description: '自动完成整条链路验证。',
      command: 'BASE_URL=http://127.0.0.1:3000 npm run smoke:license-api',
      onCopy: () => {},
    }),
  )

  assert.match(
    html,
    /rounded-lg border border-surface-200 bg-surface-100 p-5 shadow-card transition-all hover:border-brand-500\/30 hover:shadow-card-hover/,
  )
  assert.match(html, /自动化烟雾测试/)
  assert.match(html, /自动完成整条链路验证/)
  assert.match(html, /smoke:license-api/)
  assert.match(html, />复制</)
})

test('ApiDocsDebugCommandCard 支持覆盖面板、按钮与代码区样式', () => {
  const html = renderToStaticMarkup(
    React.createElement(ApiDocsDebugCommandCard, {
      title: '复用 SDK 源码',
      description: 'JS\/TS 生态优先复用 SDK。',
      command: 'src/lib/license-sdk.ts',
      onCopy: () => {},
      copyButtonLabel: '复制路径',
      panelClassName: 'custom-panel',
      buttonClassName: 'custom-button',
      codeClassName: 'custom-code',
    }),
  )

  assert.match(html, /custom-panel/)
  assert.match(html, /custom-button/)
  assert.match(html, /custom-code/)
  assert.match(html, />复制路径</)
})
