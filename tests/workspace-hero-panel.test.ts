import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { WorkspaceHeroPanel } from '../src/components/workspace-hero-panel'

test('WorkspaceHeroPanel 会渲染徽标、标题、描述、指标区和 tab 区', () => {
  const html = renderToStaticMarkup(
    React.createElement(WorkspaceHeroPanel, {
      badge: '项目工作区',
      title: '项目管理中心',
      description: '把新建项目和存量项目维护拆开处理。',
      gradientClassName: 'hero-gradient',
      metrics: React.createElement('div', { className: 'metrics-slot' }, '指标区'),
      tabs: React.createElement('div', { className: 'tabs-slot' }, 'Tab区'),
    }),
  )

  assert.match(html, /项目工作区/)
  assert.match(html, /项目管理中心/)
  assert.match(html, /把新建项目和存量项目维护拆开处理/)
  assert.match(html, /hero-gradient/)
  assert.match(html, /metrics-slot/)
  assert.match(html, /tabs-slot/)
})

test('WorkspaceHeroPanel 保留统一头部视觉结构', () => {
  const html = renderToStaticMarkup(
    React.createElement(WorkspaceHeroPanel, {
      badge: '消费日志工作区',
      title: '消费日志排查中心',
      description: '长表格只负责阅读与导出。',
      gradientClassName: 'consumption-gradient',
      metrics: React.createElement(React.Fragment, null),
      tabs: React.createElement(React.Fragment, null),
    }),
  )

  assert.match(html, /rounded-full border border-sky-200\/80 bg-white\/80/)
  assert.match(html, /text-\[11px\] font-semibold tracking-\[0\.22em\] text-sky-700/)
  assert.match(html, /text-2xl font-semibold tracking-tight text-slate-900/)
  assert.match(html, /text-sm leading-7 text-slate-500 sm:text-base/)
})
