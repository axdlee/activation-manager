import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { ConsumptionWorkspace } from '../src/components/consumption-workspace'

function createProps(
  overrides: Partial<React.ComponentProps<typeof ConsumptionWorkspace>> = {},
) {
  return {
    activeTab: 'filters' as const,
    onTabChange: () => {},
    matchedCount: 2,
    projectCoverage: 1,
    codeCoverage: 2,
    loading: false,
    panelClassName: 'panel-class',
    workspaceSummaryCardClassName: 'metric-class',
    compactInputClassName: 'input-class',
    primaryButtonClassName: 'primary-button',
    successButtonClassName: 'success-button',
    ghostButtonClassName: 'ghost-button',
    paginationButtonClassName: 'page-button',
    paginationActiveButtonClassName: 'page-button-active',
    filtersView: {
      searchTerm: 'req-001',
      projectFilter: 'browser-plugin',
      createdFrom: '2026-03-25T08:00',
      createdTo: '2026-03-25T12:00',
      projectOptions: [{ id: 1, name: '浏览器插件', projectKey: 'browser-plugin' }],
      filterTokens: ['关键词：req-001', '项目：浏览器插件'],
      refreshStatusText: '最近一次刷新成功',
      refreshStatusBadgeClassName: 'badge-success',
      autoRefreshDelayMs: 400,
      totalCount: 2,
      onSearchTermChange: () => {},
      onProjectFilterChange: () => {},
      onCreatedFromChange: () => {},
      onCreatedToChange: () => {},
      onRefresh: () => {},
      onExport: () => {},
      onReset: () => {},
      onApplyToday: () => {},
      onApplyLast7Days: () => {},
      onApplyLast30Days: () => {},
      onClearTimeRange: () => {},
    },
    logsView: {
      filterTokens: ['项目：浏览器插件'],
      refreshStatusText: '最近一次刷新成功',
      refreshStatusBadgeClassName: 'badge-success',
      autoRefreshDelayMs: 400,
      totalCount: 1,
      startIndex: 1,
      endIndex: 1,
      currentPage: 1,
      totalPages: 1,
      logs: [
        {
          id: 1,
          requestId: 'req-001',
          machineId: 'mac-001',
          remainingCountAfter: 7,
          createdAt: '2026-03-25T10:00:00.000Z',
          activationCode: {
            code: 'CODE-001',
            licenseMode: 'COUNT' as const,
            project: {
              name: '浏览器插件',
            },
          },
        },
      ],
      onRefresh: () => {},
      onExport: () => {},
      onPageChange: () => {},
      getLicenseModeDisplay: () => '次数型',
    },
    ...overrides,
  }
}

test('ConsumptionWorkspace 在 filters tab 渲染筛选表单、快捷时间范围与刷新状态', () => {
  const html = renderToStaticMarkup(React.createElement(ConsumptionWorkspace, createProps()))

  assert.equal(html.includes('消费日志排查中心'), true)
  assert.equal(html.includes('筛选与刷新'), true)
  assert.equal(html.includes('搜索 requestId / 机器ID / 激活码'), true)
  assert.equal(html.includes('项目筛选'), true)
  assert.equal(html.includes('开始时间'), true)
  assert.equal(html.includes('结束时间'), true)
  assert.equal(html.includes('快捷时间范围'), true)
  assert.equal(html.includes('最近7天'), true)
  assert.equal(html.includes('清空时间'), true)
  assert.equal(html.includes('刷新状态'), true)
  assert.equal(html.includes('自动刷新已开启（400ms 防抖）'), true)
  assert.equal(html.includes('导出筛选结果'), true)
})

test('ConsumptionWorkspace 在 logs tab 渲染日志列表、摘要与操作按钮', () => {
  const html = renderToStaticMarkup(
    React.createElement(
      ConsumptionWorkspace,
      createProps({
        activeTab: 'logs',
      }),
    ),
  )

  assert.equal(html.includes('消费日志 (1 条记录)'), true)
  assert.equal(html.includes('查看筛选器'), true)
  assert.equal(html.includes('刷新消费日志'), true)
  assert.equal(html.includes('导出筛选结果'), true)
  assert.equal(html.includes('浏览器插件'), true)
  assert.equal(html.includes('CODE-001'), true)
  assert.equal(html.includes('req-001'), true)
  assert.equal(html.includes('mac-001'), true)
  assert.equal(html.includes('次数型'), true)
  assert.equal(html.includes('7'), true)
})

test('ConsumptionWorkspace 在 logs tab loading 或空数据时渲染加载与空状态', () => {
  const loadingHtml = renderToStaticMarkup(
    React.createElement(
      ConsumptionWorkspace,
      createProps({
        activeTab: 'logs',
        loading: true,
      }),
    ),
  )

  assert.equal(loadingHtml.includes('最近一次刷新成功'), true)

  const emptyHtml = renderToStaticMarkup(
    React.createElement(
      ConsumptionWorkspace,
      createProps({
        activeTab: 'logs',
        loading: false,
        logsView: {
          ...createProps().logsView,
          totalCount: 0,
          startIndex: 0,
          endIndex: 0,
          totalPages: 0,
          logs: [],
        },
      }),
    ),
  )

  assert.equal(
    emptyHtml.includes('暂无匹配的消费日志，建议切换到“筛选与刷新”调整关键词、项目或时间范围。'),
    true,
  )
})
