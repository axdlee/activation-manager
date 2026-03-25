import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { DashboardActionPanel } from '../src/components/dashboard-action-panel'

test('DashboardActionPanel 会渲染默认暗色行动卡结构、标题与操作区', () => {
  const html = renderToStaticMarkup(
    React.createElement(DashboardActionPanel, {
      badge: '创建后立即可用',
      title: '准备创建新的项目空间？',
      description: '新项目会立即出现在发码、统计和激活码筛选中。',
      action: React.createElement('button', { className: 'action-slot' }, '创建项目'),
      children: React.createElement('div', { className: 'meta-slot' }, '附加说明'),
    }),
  )

  assert.match(
    html,
    /rounded-\[26px\] border border-slate-900\/10 bg-slate-950\/95 p-5 text-white shadow-\[0_24px_64px_-42px_rgba\(15,23,42,0\.7\)\]/,
  )
  assert.match(html, /flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between/)
  assert.match(
    html,
    /inline-flex items-center rounded-full border border-white\/10 bg-white\/10 px-3 py-1 text-\[11px\] font-semibold tracking-\[0\.22em\] text-slate-200/,
  )
  assert.match(html, /准备创建新的项目空间？/)
  assert.match(html, /新项目会立即出现在发码、统计和激活码筛选中/)
  assert.match(html, /action-slot/)
  assert.match(html, /meta-slot/)
})

test('DashboardActionPanel 支持覆盖容器、布局与文案样式，并注入背景层', () => {
  const html = renderToStaticMarkup(
    React.createElement(DashboardActionPanel, {
      badge: '确认后立即生效',
      title: '准备提交本次密码变更？',
      description: '修改成功后系统会提示重新登录。',
      action: React.createElement('button', { className: 'custom-action' }, '修改密码'),
      className: 'custom-shell',
      innerClassName: 'custom-inner',
      contentClassName: 'custom-content',
      badgeClassName: 'custom-badge',
      titleClassName: 'custom-title',
      descriptionClassName: 'custom-description',
      background: React.createElement('div', { className: 'custom-background' }),
    }),
  )

  assert.match(html, /custom-shell/)
  assert.match(html, /custom-inner/)
  assert.match(html, /custom-content/)
  assert.match(html, /custom-badge/)
  assert.match(html, /custom-title/)
  assert.match(html, /custom-description/)
  assert.match(html, /custom-background/)
  assert.match(html, /custom-action/)
  assert.doesNotMatch(
    html,
    /rounded-\[26px\] border border-slate-900\/10 bg-slate-950\/95 p-5 text-white shadow-\[0_24px_64px_-42px_rgba\(15,23,42,0\.7\)\]/,
  )
})
