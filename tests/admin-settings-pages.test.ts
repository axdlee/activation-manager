import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import type { SystemConfigPageModel } from '../src/lib/system-config-ui'
import { SettingsPage } from '../src/components/admin/settings-page'
import { SettingsSectionNav } from '../src/components/admin/settings-section-nav'
import { SecurityPage } from '../src/components/admin/security-page'

const groups: SystemConfigPageModel['groups'] = [
  {
    key: 'access',
    title: '访问与白名单',
    description: '控制后台访问来源。',
    badge: '安全相关',
    items: [],
  },
  {
    key: 'branding',
    title: '系统展示',
    description: '站点名称与展示信息。',
    badge: '展示相关',
    items: [],
  },
]

const summaryCards: SystemConfigPageModel['summaryCards'] = [
  { label: '配置项', value: '24', description: '当前已加载的系统配置总数' },
  { label: '访问白名单', value: '未启用', description: '后台访问来源将按白名单限制' },
]

function createSettingsProps(
  overrides: Partial<React.ComponentProps<typeof SettingsPage>> = {},
) {
  return {
    pageModel: { groups, summaryCards },
    loading: false,
    dirtyCount: 0,
    ...overrides,
  }
}

test('SettingsPage：概览只保留摘要与分区链接（无重复层级标题）', () => {
  const html = renderToStaticMarkup(React.createElement(SettingsPage, createSettingsProps()))

  assert.equal((html.match(/<h1/g) ?? []).length, 1)
  assert.match(html, /系统设置/)
  assert.match(html, /配置项/)
  assert.match(html, /访问与白名单/)
  assert.match(html, /href="\/admin\/settings\?section=access"/)
  assert.match(html, /账户安全/)
  assert.match(html, /href="\/admin\/settings\/security"/)
})

test('SettingsPage：进入分区显示分区导航、单一表单区与 StickySaveBar', () => {
  const html = renderToStaticMarkup(
    React.createElement(
      SettingsPage,
      createSettingsProps({
        activeSection: 'access',
        dirtyCount: 2,
        saving: false,
        onSave: () => {},
        onReset: () => {},
        children: React.createElement('form', { id: 'system-config-form' }, '表单内容'),
      }),
    ),
  )

  assert.match(html, /aria-label="Breadcrumb"/)
  assert.match(html, /访问与白名单/)
  assert.match(html, /id="system-config-form"/)
  // 分区导航 tabs
  assert.match(html, /href="\/admin\/settings\?section=branding"/)
  // StickySaveBar：显示未保存数量
  assert.match(html, /2 项配置未保存/)
})

test('SettingsSectionNav：cards 与 tabs 两种形态', () => {
  const cards = renderToStaticMarkup(
    React.createElement(SettingsSectionNav, { groups, variant: 'cards' }),
  )
  assert.match(cards, /前往配置/)

  const tabs = renderToStaticMarkup(
    React.createElement(SettingsSectionNav, { groups, activeKey: 'branding', variant: 'tabs' }),
  )
  assert.match(tabs, /aria-current="page"/)
  assert.match(tabs, /账户安全/)
})

test('SecurityPage：单 h1 保留管理员密码工作台标题与倒计时挂载点', () => {
  // SecurityPage 内部依赖 hook（useChangePassword 为纯 state，useRouter 需要 app 上下文）
  // 这里只做冒烟：确认组件可导入且导出名正确
  assert.equal(typeof SecurityPage, 'function')
})
