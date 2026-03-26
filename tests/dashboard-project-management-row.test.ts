import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { DashboardProjectManagementRow } from '../src/components/dashboard-project-management-row'

test('DashboardProjectManagementRow 会渲染默认项目的固定提示、策略信息与受限操作', () => {
  const html = renderToStaticMarkup(
    React.createElement(DashboardProjectManagementRow, {
      project: {
        id: 1,
        projectKey: 'default',
        isEnabled: true,
        allowAutoRebind: null,
        autoRebindCooldownMinutes: null,
        autoRebindMaxCount: null,
      },
      nameValue: '默认项目',
      descriptionValue: '系统默认项目',
      rebindPolicyValue: 'inherit',
      rebindCooldownMinutesValue: '',
      rebindMaxCountValue: '',
      compactInputClassName: 'compact-input',
      loading: false,
      canSaveName: false,
      canSaveDescription: false,
      canSaveRebindSettings: false,
      onNameChange: () => {},
      onDescriptionChange: () => {},
      onRebindPolicyChange: () => {},
      onRebindCooldownMinutesChange: () => {},
      onRebindMaxCountChange: () => {},
      onCopyProjectKey: () => {},
      onSaveName: () => {},
      onSaveDescription: () => {},
      onSaveRebindSettings: () => {},
      onToggleStatus: () => {},
      onDelete: () => {},
    }),
  )

  assert.match(html, /<tr class="transition hover:bg-slate-50\/80">/)
  assert.match(html, /默认项目名称固定/)
  assert.match(html, /value="默认项目"/)
  assert.match(html, /value="系统默认项目"/)
  assert.match(html, /继承系统配置/)
  assert.match(html, /冷却时间跟随系统配置/)
  assert.match(html, /换绑次数跟随系统配置/)
  assert.match(html, /保存换绑策略/)
  assert.match(html, /复制/)
  assert.match(html, /保存名称/)
  assert.match(html, /保存描述/)
  assert.match(html, /停用/)
  assert.match(html, /启用中/)
  assert.doesNotMatch(html, /删除/)
})

test('DashboardProjectManagementRow 会渲染普通项目的换绑策略编辑能力', () => {
  const html = renderToStaticMarkup(
    React.createElement(DashboardProjectManagementRow, {
      project: {
        id: 2,
        projectKey: 'browser-plugin',
        isEnabled: false,
        allowAutoRebind: true,
        autoRebindCooldownMinutes: 180,
        autoRebindMaxCount: 2,
      },
      nameValue: '浏览器插件项目',
      descriptionValue: '浏览器插件授权',
      rebindPolicyValue: 'enabled',
      rebindCooldownMinutesValue: '180',
      rebindMaxCountValue: '2',
      compactInputClassName: 'compact-input',
      loading: false,
      canSaveName: true,
      canSaveDescription: true,
      canSaveRebindSettings: true,
      onNameChange: () => {},
      onDescriptionChange: () => {},
      onRebindPolicyChange: () => {},
      onRebindCooldownMinutesChange: () => {},
      onRebindMaxCountChange: () => {},
      onCopyProjectKey: () => {},
      onSaveName: () => {},
      onSaveDescription: () => {},
      onSaveRebindSettings: () => {},
      onToggleStatus: () => {},
      onDelete: () => {},
    }),
  )

  assert.match(html, /browser-plugin/)
  assert.match(html, /项目描述（可选）/)
  assert.match(html, /允许自助换绑/)
  assert.match(html, /value="180"/)
  assert.match(html, /value="2"/)
  assert.match(html, /最多自助换绑 2 次/)
  assert.match(html, /保存换绑策略/)
  assert.match(html, /保存名称/)
  assert.match(html, /保存描述/)
  assert.match(html, /启用/)
  assert.match(html, /删除/)
  assert.match(html, /已停用/)
  assert.match(html, /compact-input min-w-\[180px\]/)
  assert.match(html, /compact-input min-w-\[220px\]/)
  assert.doesNotMatch(html, /默认项目名称固定/)
})
