import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { ActivationCodeWorkspace } from '../src/components/activation-code-workspace'

function createProps(
  overrides: Partial<React.ComponentProps<typeof ActivationCodeWorkspace>> = {},
) {
  return {
    activeTab: 'filters' as const,
    onTabChange: () => {},
    loading: false,
    matchedCount: 2,
    projectCoverage: 1,
    riskCount: 1,
    panelClassName: 'panel-class',
    workspaceSummaryCardClassName: 'metric-class',
    compactInputClassName: 'input-class',
    primaryButtonClassName: 'primary-button',
    successButtonClassName: 'success-button',
    warningButtonClassName: 'warning-button',
    ghostButtonClassName: 'ghost-button',
    paginationButtonClassName: 'page-button',
    paginationActiveButtonClassName: 'page-button-active',
    filtersView: {
      searchTerm: 'MAC-001',
      statusFilter: 'used' as const,
      projectFilter: 'browser-plugin',
      cardTypeFilter: '月卡',
      availableCardTypes: ['周卡', '月卡'],
      projectOptions: [{ id: 1, name: '浏览器插件', projectKey: 'browser-plugin' }],
      filterTokens: ['关键词：MAC-001', '状态：已使用 / 使用中'],
      statusSummary: {
        unused: 1,
        inUse: 1,
        risk: 1,
      },
      onSearchTermChange: () => {},
      onStatusFilterChange: () => {},
      onProjectFilterChange: () => {},
      onCardTypeFilterChange: () => {},
      onReset: () => {},
      onExport: () => {},
    },
    resultsView: {
      filterTokens: ['项目：浏览器插件'],
      filteredCount: 1,
      startIndex: 1,
      endIndex: 1,
      currentPage: 1,
      totalPages: 1,
      codes: [
        {
          id: 1,
          code: 'CODE-001',
          licenseMode: 'COUNT' as const,
          createdAt: '2026-03-25T10:00:00.000Z',
          usedAt: null,
          usedBy: 'MAC-001',
        },
      ],
      onExport: () => {},
      onCleanup: () => {},
      onPageChange: () => {},
      onCopyCode: () => {},
      onDeleteCode: () => {},
      getProjectDisplay: () => '浏览器插件',
      getStatusBadge: () => React.createElement('span', null, '已使用'),
      getLicenseModeDisplay: () => '次数型',
      getSpecDisplay: () => '10 次',
      getExpiryDisplay: () => '-',
      getRemainingDisplay: () => '8 / 10',
    },
    ...overrides,
  }
}

test('ActivationCodeWorkspace 在 filters tab 渲染筛选表单、当前条件与统计摘要', () => {
  const html = renderToStaticMarkup(
    React.createElement(ActivationCodeWorkspace, createProps()),
  )

  assert.equal(html.includes('激活码管理中心'), true)
  assert.equal(html.includes('筛选与导出'), true)
  assert.equal(html.includes('搜索激活码或机器ID'), true)
  assert.equal(html.includes('状态筛选'), true)
  assert.equal(html.includes('项目筛选'), true)
  assert.equal(html.includes('套餐类型'), true)
  assert.equal(html.includes('当前生效条件'), true)
  assert.equal(html.includes('关键词：MAC-001'), true)
  assert.equal(html.includes('未激活'), true)
  assert.equal(html.includes('风险项'), true)
})

test('ActivationCodeWorkspace 在 results tab 渲染结果列表、摘要与操作按钮', () => {
  const html = renderToStaticMarkup(
    React.createElement(
      ActivationCodeWorkspace,
      createProps({
        activeTab: 'results',
      }),
    ),
  )

  assert.equal(html.includes('激活码列表 (1 条记录)'), true)
  assert.equal(html.includes('查看筛选器'), true)
  assert.equal(html.includes('导出筛选结果'), true)
  assert.equal(html.includes('清理过期绑定'), true)
  assert.equal(html.includes('浏览器插件'), true)
  assert.equal(html.includes('CODE-001'), true)
  assert.equal(html.includes('次数型'), true)
  assert.equal(html.includes('8 / 10'), true)
  assert.equal(html.includes('复制'), true)
  assert.equal(html.includes('删除'), true)
})

test('ActivationCodeWorkspace 在 results tab loading 或空数据时渲染加载与空状态', () => {
  const loadingHtml = renderToStaticMarkup(
    React.createElement(
      ActivationCodeWorkspace,
      createProps({
        activeTab: 'results',
        loading: true,
      }),
    ),
  )

  assert.equal(loadingHtml.includes('加载中...'), true)

  const emptyHtml = renderToStaticMarkup(
    React.createElement(
      ActivationCodeWorkspace,
      createProps({
        activeTab: 'results',
        loading: false,
        resultsView: {
          ...createProps().resultsView,
          filteredCount: 0,
          startIndex: 0,
          endIndex: 0,
          totalPages: 0,
          codes: [],
        },
      }),
    ),
  )

  assert.equal(
    emptyHtml.includes('暂无匹配的激活码记录，建议切换到“筛选与导出”检查关键词、项目或套餐条件。'),
    true,
  )
})
