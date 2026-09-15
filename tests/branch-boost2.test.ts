/**
 * 分支覆盖补充：任务页条件分支（空态三态/错误态/概览与分区互斥）。
 */
import './helpers/dom'
import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { render, screen } from '@testing-library/react'

import { SettingsPage } from '../src/components/admin/settings-page'
import { LicensesPage } from '../src/components/admin/licenses-page'
import { ConsumptionsPage } from '../src/components/admin/consumptions-page'
import { AuditPage } from '../src/components/admin/audit-page'
import type { SystemConfigPageModel } from '../src/lib/system-config-ui'

const groups: SystemConfigPageModel['groups'] = [
  { key: 'access', title: '访问与白名单', description: '控制后台访问来源。', badge: '安全相关', items: [] },
]
const summaryCards: SystemConfigPageModel['summaryCards'] = [
  { label: '配置项', value: '1', description: '说明' },
]

test('SettingsPage：error 覆盖概览与分区两条渲染路径', () => {
  const overview = render(
    React.createElement(SettingsPage, {
      pageModel: { groups, summaryCards },
      error: '加载失败',
      onRetry: () => {},
      dirtyCount: 0,
    }),
  )
  assert.ok(screen.getByRole('alert'))
  overview.unmount()

  const section = render(
    React.createElement(SettingsPage, {
      pageModel: { groups, summaryCards },
      activeSection: 'access',
      error: '加载失败',
      onRetry: () => {},
      dirtyCount: 0,
    }),
  )
  assert.ok(screen.getByRole('alert'))
  section.unmount()
})

test('SettingsPage：loading 态文案', () => {
  render(
    React.createElement(SettingsPage, {
      pageModel: { groups, summaryCards },
      activeSection: 'access',
      loading: true,
      dirtyCount: 0,
    }),
  )
  assert.ok(screen.getByText('正在加载配置...'))
})

test('LicensesPage：空态按有无筛选切换文案', () => {
  const base = {
    projectOptions: [],
    availableCardTypes: [],
    statusSummary: { unused: 0, inUse: 0, risk: 0 },
    codes: [],
    pagination: { currentPage: 1, totalPages: 1, totalItems: 0, startIndex: 0, endIndex: 0 },
    onPageChange: () => {},
    onCopyCode: () => {},
    onDeleteRequest: () => {},
    onOpenDetail: () => {},
    onExport: () => {},
    onCleanupRequest: () => {},
  }
  const filters = { keyword: '', status: 'all' as const, projectKey: 'all', cardType: 'all', page: 1 }
  const { unmount } = render(
    React.createElement(LicensesPage, { ...base, filters, onFiltersChange: () => {} }),
  )
  assert.ok(screen.getByText('还没有激活码'))
  unmount()

  const { unmount: unmount2 } = render(
    React.createElement(LicensesPage, {
      ...base,
      filters: { ...filters, status: 'used' },
      onFiltersChange: () => {},
    }),
  )
  assert.ok(screen.getByText('没有匹配的激活码'))
  unmount2()
})

test('ConsumptionsPage：无筛选空态与筛选空态', () => {
  const base = {
    projectOptions: [],
    autoRefresh: false,
    onAutoRefreshChange: () => {},
    logs: [],
    pagination: { currentPage: 1, totalPages: 1, totalItems: 0, startIndex: 0, endIndex: 0 },
    onPageChange: () => {},
    onExport: () => {},
    onOpenDetail: () => {},
  }
  const { unmount } = render(
    React.createElement(ConsumptionsPage, {
      ...base,
      filters: { keyword: '', projectKey: 'all', createdFrom: '', createdTo: '', page: 1 },
      onFiltersChange: () => {},
    }),
  )
  assert.ok(screen.getByText('暂无消费日志'))
  unmount()

  const { unmount: unmount2 } = render(
    React.createElement(ConsumptionsPage, {
      ...base,
      filters: { keyword: 'x', projectKey: 'all', createdFrom: '', createdTo: '', page: 1 },
      onFiltersChange: () => {},
    }),
  )
  assert.ok(screen.getByText('没有匹配的消费日志'))
  unmount2()
})

test('AuditPage：空态按有无筛选切换文案', () => {
  const base = {
    projectOptions: [],
    operationTypeOptions: [],
    getOperationTypeLabel: (op: string) => op,
    logs: [],
    pagination: { currentPage: 1, totalPages: 1, totalItems: 0, startIndex: 0, endIndex: 0 },
    onPageChange: () => {},
    onExport: () => {},
    onOpenDetail: () => {},
  }
  const { unmount } = render(
    React.createElement(AuditPage, {
      ...base,
      filters: { keyword: '', projectKey: 'all', operationType: 'all', createdFrom: '', createdTo: '', page: 1 },
      onFiltersChange: () => {},
    }),
  )
  assert.ok(screen.getByText('暂无操作记录'))
  unmount()

  const { unmount: unmount2 } = render(
    React.createElement(AuditPage, {
      ...base,
      filters: { keyword: 'x', projectKey: 'all', operationType: 'all', createdFrom: '', createdTo: '', page: 1 },
      onFiltersChange: () => {},
    }),
  )
  assert.ok(screen.getByText('没有匹配的操作记录'))
  unmount2()
})
