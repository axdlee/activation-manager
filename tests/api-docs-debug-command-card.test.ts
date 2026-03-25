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
    /rounded-\[24px\] border border-slate-200\/80 bg-\[linear-gradient\(180deg,rgba\(255,255,255,0\.98\),rgba\(248,250,252,0\.92\)\)\] p-5 shadow-\[0_18px_56px_-42px_rgba\(15,23,42,0\.22\)\]/,
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
