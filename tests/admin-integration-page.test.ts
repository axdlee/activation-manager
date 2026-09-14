import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { CodeExampleBlock } from '../src/components/admin/code-example-block'
import { DocsSidebar } from '../src/components/admin/docs-sidebar'

const sections = [
  { key: 'overview', label: '接入概览', description: '先看调研路径、授权模型与字段规范' },
  { key: 'endpoints', label: '正式接口', description: '激活 / 校验 / 状态查询' },
  { key: 'examples', label: '多语言示例', description: 'cURL / Node.js / Python' },
  { key: 'admin', label: '后台联调', description: '内含管理接口与本地联调脚本入口' },
]

test('CodeExampleBlock：可折叠结构、代码渲染与复制按钮', () => {
  const html = renderToStaticMarkup(
    React.createElement(CodeExampleBlock, {
      title: 'cURL',
      code: 'curl -X POST https://example.com/api/license/activate',
      defaultOpen: true,
    }),
  )

  assert.match(html, /<details[^>]*open/)
  assert.match(html, /data-code-block="cURL"/)
  assert.match(html, /<code>curl -X POST/)
  assert.match(html, /aria-label="复制 cURL"/)
})

test('CodeExampleBlock：默认折叠', () => {
  const html = renderToStaticMarkup(
    React.createElement(CodeExampleBlock, { title: 'Node.js', code: 'fetch("https://x")' }),
  )
  assert.doesNotMatch(html, /<details[^>]*open/)
})

test('DocsSidebar：桌面目录渲染四个章节按钮并标记当前章节', () => {
  const html = renderToStaticMarkup(
    React.createElement(DocsSidebar, {
      sections,
      activeKey: 'endpoints',
      onNavigate: () => {},
    }),
  )

  // e2e 依赖 `div.mt-6.grid` 容器与按钮 label
  assert.match(html, /class="mt-6 grid grid-cols-1 gap-2"/)
  for (const label of ['接入概览', '正式接口', '多语言示例', '后台联调']) {
    assert.match(html, new RegExp(label))
  }
  assert.match(html, /aria-current="page"/)
})

test('DocsSidebar：移动端下拉存在', () => {
  const html = renderToStaticMarkup(
    React.createElement(DocsSidebar, { sections, activeKey: 'overview', onNavigate: () => {} }),
  )
  assert.match(html, /<details/)
})
