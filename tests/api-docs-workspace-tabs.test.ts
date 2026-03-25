import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { ApiDocsWorkspace } from '../src/components/api-docs-workspace'

test('ApiDocsWorkspace 支持以 endpoints tab 作为初始工作区渲染接口示例', () => {
  const html = renderToStaticMarkup(
    React.createElement(ApiDocsWorkspace, {
      mode: 'public',
      initialTab: 'endpoints',
    }),
  )

  assert.equal(html.includes('激活接口'), true)
  assert.equal(html.includes('/api/license/activate'), true)
  assert.equal(html.includes('请求示例'), true)
  assert.equal(html.includes('响应示例'), true)
  assert.equal(html.includes('复制路径'), true)
})

test('ApiDocsWorkspace 支持以 examples tab 作为初始工作区渲染多语言示例', () => {
  const html = renderToStaticMarkup(
    React.createElement(ApiDocsWorkspace, {
      mode: 'public',
      initialTab: 'examples',
    }),
  )

  assert.equal(html.includes('JavaScript / TypeScript SDK'), true)
  assert.equal(html.includes('Python requests'), true)
  assert.equal(html.includes('cURL / Postman 参考'), true)
  assert.equal(html.includes('复制示例代码'), true)
})

test('ApiDocsWorkspace 支持以 admin tab 作为初始工作区渲染后台接口与联调命令', () => {
  const html = renderToStaticMarkup(
    React.createElement(ApiDocsWorkspace, {
      mode: 'dashboard',
      initialTab: 'admin',
    }),
  )

  assert.equal(html.includes('联调时常用的后台接口'), true)
  assert.equal(html.includes('项目与发码'), true)
  assert.equal(html.includes('日志与统计'), true)
  assert.equal(html.includes('本地联调与排查辅助'), true)
  assert.equal(html.includes('smoke:license-api'), true)
  assert.equal(html.includes('src/lib/license-sdk.ts'), true)
})
