import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { AuditLogWorkspace } from '../src/components/audit-log-workspace'

function createProps(
  overrides: Partial<React.ComponentProps<typeof AuditLogWorkspace>> = {},
) {
  return {
    activeTab: 'filters' as const,
    onTabChange: () => {},
    loading: false,
    matchedCount: 3,
    operatorCoverage: 2,
    projectCoverage: 2,
    panelClassName: 'panel-class',
    workspaceSummaryCardClassName: 'metric-class',
    compactInputClassName: 'input-class',
    primaryButtonClassName: 'primary-button',
    successButtonClassName: 'success-button',
    ghostButtonClassName: 'ghost-button',
    paginationButtonClassName: 'page-button',
    paginationActiveButtonClassName: 'page-button-active',
    filtersView: {
      searchTerm: '换电脑',
      projectFilter: 'browser-plugin',
      operationTypeFilter: 'CODE_FORCE_REBIND',
      createdFrom: '2026-03-01T00:00',
      createdTo: '2026-03-31T23:59',
      projectOptions: [{ id: 1, name: '浏览器插件', projectKey: 'browser-plugin' }],
      operationTypeOptions: [
        { value: 'CODE_FORCE_REBIND', label: '管理员强制换绑' },
        { value: 'PROJECT_CREATED', label: '创建项目' },
      ],
      filterTokens: ['关键词：换电脑', '操作：管理员强制换绑'],
      onSearchTermChange: () => {},
      onProjectFilterChange: () => {},
      onOperationTypeFilterChange: () => {},
      onCreatedFromChange: () => {},
      onCreatedToChange: () => {},
      onReset: () => {},
      onExport: () => {},
    },
    logsView: {
      filterTokens: ['项目：浏览器插件'],
      totalCount: 3,
      startIndex: 1,
      endIndex: 2,
      currentPage: 1,
      totalPages: 2,
      logs: [
        {
          id: 1,
          adminUsername: 'admin',
          operationType: 'CODE_FORCE_REBIND',
          operationTypeLabel: '管理员强制换绑',
          targetLabel: 'CODE-001',
          reason: '用户换电脑',
          detailSummary: 'old-machine → new-machine',
          createdAt: '2026-03-25T10:00:00.000Z',
          project: {
            id: 1,
            name: '浏览器插件',
            projectKey: 'browser-plugin',
          },
          activationCode: {
            id: 11,
            code: 'CODE-001',
          },
        },
      ],
      onExport: () => {},
      onPageChange: () => {},
    },
    ...overrides,
  }
}

test('AuditLogWorkspace 在 filters tab 渲染筛选条件与导出入口', () => {
  const html = renderToStaticMarkup(React.createElement(AuditLogWorkspace, createProps()))

  assert.equal(html.includes('全局审计中心'), true)
  assert.equal(html.includes('筛选与导出'), true)
  assert.equal(html.includes('搜索管理员 / 目标 / 原因'), true)
  assert.equal(html.includes('操作类型'), true)
  assert.equal(html.includes('开始时间'), true)
  assert.equal(html.includes('结束时间'), true)
  assert.equal(html.includes('关键词：换电脑'), true)
  assert.equal(html.includes('管理员强制换绑'), true)
})

test('AuditLogWorkspace 在 logs tab 渲染审计日志列表与分页摘要', () => {
  const html = renderToStaticMarkup(
    React.createElement(
      AuditLogWorkspace,
      createProps({
        activeTab: 'logs',
      }),
    ),
  )

  assert.equal(html.includes('审计日志列表 (3 条记录)'), true)
  assert.equal(html.includes('查看筛选器'), true)
  assert.equal(html.includes('导出筛选结果'), true)
  assert.equal(html.includes('管理员强制换绑'), true)
  assert.equal(html.includes('浏览器插件'), true)
  assert.equal(html.includes('CODE-001'), true)
  assert.equal(html.includes('用户换电脑'), true)
  assert.equal(html.includes('old-machine → new-machine'), true)
  assert.equal(html.includes('显示第 1 - 2 条，共 3 条记录'), true)
})
