import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { DashboardProjectManagementRow } from '../src/components/dashboard-project-management-row'

test('DashboardProjectManagementRow 会渲染默认项目的固定提示与受限操作', () => {
  const html = renderToStaticMarkup(
    React.createElement(DashboardProjectManagementRow, {
      project: {
        id: 1,
        projectKey: 'default',
        isEnabled: true,
      },
      nameValue: '默认项目',
      descriptionValue: '系统默认项目',
      compactInputClassName: 'compact-input',
      loading: false,
      canSaveName: false,
      canSaveDescription: false,
      onNameChange: () => {},
      onDescriptionChange: () => {},
      onCopyProjectKey: () => {},
      onSaveName: () => {},
      onSaveDescription: () => {},
      onToggleStatus: () => {},
      onDelete: () => {},
    }),
  )

  assert.match(html, /<tr class="transition hover:bg-slate-50\/80">/)
  assert.match(html, /默认项目名称固定/)
  assert.match(html, /value="默认项目"/)
  assert.match(html, /value="系统默认项目"/)
  assert.match(html, /复制/)
  assert.match(html, /保存名称/)
  assert.match(html, /保存描述/)
  assert.match(html, /停用/)
  assert.match(html, /启用中/)
  assert.doesNotMatch(html, /删除/)
})

test('DashboardProjectManagementRow 会渲染普通项目的可编辑字段、状态与删除操作', () => {
  const html = renderToStaticMarkup(
    React.createElement(DashboardProjectManagementRow, {
      project: {
        id: 2,
        projectKey: 'browser-plugin',
        isEnabled: false,
      },
      nameValue: '浏览器插件项目',
      descriptionValue: '浏览器插件授权',
      compactInputClassName: 'compact-input',
      loading: false,
      canSaveName: true,
      canSaveDescription: true,
      onNameChange: () => {},
      onDescriptionChange: () => {},
      onCopyProjectKey: () => {},
      onSaveName: () => {},
      onSaveDescription: () => {},
      onToggleStatus: () => {},
      onDelete: () => {},
    }),
  )

  assert.match(html, /browser-plugin/)
  assert.match(html, /项目描述（可选）/)
  assert.match(html, /保存名称/)
  assert.match(html, /保存描述/)
  assert.match(html, /启用/)
  assert.match(html, /删除/)
  assert.match(html, /已停用/)
  assert.match(html, /compact-input min-w-\[180px\]/)
  assert.match(html, /compact-input min-w-\[220px\]/)
  assert.doesNotMatch(html, /默认项目名称固定/)
})
