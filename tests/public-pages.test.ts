import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// tsx 运行时动态 import .tsx 会带一层 default 包装，tsc 静态类型则没有；
// 统一按「模块可能带 default」处理取值。
type DynamicModule = { default?: unknown } & Record<string, any>

async function loadDefaultComponent(modulePath: string) {
  const mod = (await import(modulePath)) as DynamicModule
  const component = (mod.default as DynamicModule | undefined)?.default ?? mod.default

  assert.equal(typeof component, 'function')

  return {
    component: component as React.ComponentType,
    moduleExports: mod.default ?? mod,
  }
}

test('首页会渲染管理后台入口与公开 API 文档入口', async () => {
  const { component: Home } = await loadDefaultComponent('../src/app/page')
  const html = renderToStaticMarkup(React.createElement(Home))

  assert.equal(html.includes('激活码管理系统'), true)
  assert.equal(html.includes('进入管理后台'), true)
  assert.equal(html.includes('查看 API 文档'), true)
  assert.equal(html.includes('多项目隔离'), true)
  assert.equal(
    html.includes('rounded-md bg-brand-600 px-4 py-2.5 text-sm font-medium text-white'),
    true,
  )
  assert.equal(
    html.includes('bg-gradient-to-r from-sky-600 via-cyan-500 to-indigo-500'),
    false,
  )
})

test('公开 API 文档页暴露 metadata，并渲染首页与登录入口', async () => {
  const mod = (await import('../src/app/docs/api/page')) as DynamicModule
  const ApiDocsPage = ((mod.default as DynamicModule | undefined)?.default ?? mod.default) as React.ComponentType
  const html = renderToStaticMarkup(React.createElement(ApiDocsPage))
  const metadata = ((mod.default as DynamicModule | undefined)?.metadata ?? mod.metadata ?? {}) as {
    title?: string
    description?: string
  }

  assert.equal(metadata.title, 'API 接入文档')
  assert.match(
    metadata.description || '',
    /公开 API 接入文档|公开 API 文档|正式接口/,
  )
  assert.equal(html.includes('面向插件与客户端的 API 文档中心'), true)
  assert.equal(html.includes('管理员登录'), true)
  assert.equal(html.includes('返回首页'), true)
  assert.equal(html.includes('bg-surface-50'), true)
  assert.equal(
    html.includes('bg-gradient-to-r from-sky-600 via-cyan-500 to-indigo-500'),
    true,
  )
})

test('ApiDocsWorkspace 在 public 模式下会渲染公开文档文案与默认概览内容', async () => {
  const mod = (await import('../src/components/api-docs-workspace')) as DynamicModule
  const ApiDocsWorkspace =
    ((mod.default as DynamicModule | undefined)?.ApiDocsWorkspace ??
      (mod as { ApiDocsWorkspace?: React.ComponentType<{ mode?: 'dashboard' | 'public' }> }).ApiDocsWorkspace) as React.ComponentType<{
      mode?: 'dashboard' | 'public'
    }>

  assert.equal(typeof ApiDocsWorkspace, 'function')

  const html = renderToStaticMarkup(React.createElement(ApiDocsWorkspace, { mode: 'public' }))

  assert.equal(html.includes('公开 API 文档'), true)
  assert.equal(html.includes('激活码服务接入工作区'), true)
  assert.equal(html.includes('接入概览'), true)
  assert.equal(html.includes('推荐调研路径'), true)
  assert.equal(html.includes('正式接口'), true)
  assert.equal(html.includes('多语言示例'), true)
  assert.equal(html.includes('联调后台'), true)
  assert.equal(html.includes('bg-ink-950 text-white/90'), false)
  assert.equal(html.includes('bg-gradient-to-b from-white to-surface-50'), true)
})

test('ApiDocsWorkspace 在 dashboard 模式下会渲染后台语境文案', async () => {
  const mod = (await import('../src/components/api-docs-workspace')) as DynamicModule
  const ApiDocsWorkspace =
    ((mod.default as DynamicModule | undefined)?.ApiDocsWorkspace ??
      (mod as { ApiDocsWorkspace?: React.ComponentType<{ mode?: 'dashboard' | 'public' }> }).ApiDocsWorkspace) as React.ComponentType<{
      mode?: 'dashboard' | 'public'
    }>

  const html = renderToStaticMarkup(React.createElement(ApiDocsWorkspace, { mode: 'dashboard' }))

  assert.equal(html.includes('API 接入工作区'), true)
  assert.equal(html.includes('插件与客户端接入指南'), true)
  assert.equal(html.includes('推荐正式流程'), true)
})
