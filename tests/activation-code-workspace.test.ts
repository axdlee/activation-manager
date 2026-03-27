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
      filteredCount: 2,
      startIndex: 1,
      endIndex: 2,
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
          lastBoundAt: '2026-03-25T12:00:00.000Z',
          lastRebindAt: '2026-03-25T13:00:00.000Z',
          rebindCount: 1,
          autoRebindCount: 1,
          allowAutoRebind: null,
          autoRebindCooldownMinutes: null,
          autoRebindMaxCount: null,
          project: {
            id: 1,
            name: '浏览器插件',
            projectKey: 'browser-plugin',
            allowAutoRebind: true,
            autoRebindCooldownMinutes: 180,
            autoRebindMaxCount: 2,
          },
        },
        {
          id: 2,
          code: 'CODE-002',
          licenseMode: 'TIME' as const,
          createdAt: '2026-03-26T10:00:00.000Z',
          usedAt: null,
          usedBy: null,
          lastBoundAt: null,
          lastRebindAt: null,
          rebindCount: 0,
          autoRebindCount: 0,
          allowAutoRebind: false,
          autoRebindCooldownMinutes: 60,
          autoRebindMaxCount: 1,
          project: {
            id: 1,
            name: '浏览器插件',
            projectKey: 'browser-plugin',
            allowAutoRebind: true,
            autoRebindCooldownMinutes: 180,
            autoRebindMaxCount: 2,
          },
        },
      ],
      managementView: {
        selectedCodeId: 1,
        selectedCodeTitle: 'CODE-001',
        selectedCodeSubtitle: '浏览器插件 · browser-plugin',
        bindingDeviceDisplay: 'MAC-001',
        usedAtDisplay: '2026/3/25 20:00:00',
        lastBoundAtDisplay: '2026/3/25 20:00:00',
        lastRebindAtDisplay: '2026/3/25 21:00:00',
        rebindCountDisplay: '1 次',
        autoRebindCountDisplay: '1 次',
        effectivePolicySummary: [
          '最终自助换绑：允许（来源：项目级配置）',
          '最终换绑冷却时间：180 分钟（来源：项目级配置）',
          '最终自助换绑次数上限：2 次（来源：项目级配置）',
        ],
        overridePolicyValue: 'inherit',
        overrideCooldownMinutesValue: '',
        overrideMaxCountValue: '',
        targetMachineId: '',
        adminActionReason: '用户提交了设备迁移申请',
        bindingHistoryEntries: [
          {
            id: 1,
            title: '自动换绑',
            description: 'machine-old → MAC-001',
            timestamp: '2026/3/25 21:00:00',
          },
        ],
        adminAuditEntries: [
          {
            id: 1,
            title: '管理员调整单码策略',
            description: 'admin · 将次数上限改为 2 次',
            timestamp: '2026/3/25 19:00:00',
          },
        ],
        loading: false,
        onSelectCode: () => {},
        onOverridePolicyChange: () => {},
        onOverrideCooldownMinutesChange: () => {},
        onOverrideMaxCountChange: () => {},
        onTargetMachineIdChange: () => {},
        onAdminActionReasonChange: () => {},
        onSaveSettings: () => {},
        onForceUnbind: () => {},
        onForceRebind: () => {},
      },
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

test('ActivationCodeWorkspace 在 results tab 渲染绑定设备列、弹框管理入口与单码管理内容', () => {
  const html = renderToStaticMarkup(
    React.createElement(
      ActivationCodeWorkspace,
      createProps({
        activeTab: 'results',
      }),
    ),
  )

  assert.equal(html.includes('激活码列表 (2 条记录)'), true)
  assert.equal(html.includes('查看筛选器'), true)
  assert.equal(html.includes('导出筛选结果'), true)
  assert.equal(html.includes('清理过期绑定'), true)
  assert.equal(html.includes('浏览器插件'), true)
  assert.equal(html.includes('CODE-001'), true)
  assert.equal(html.includes('次数型'), true)
  assert.equal(html.includes('8 / 10'), true)
  assert.equal(html.includes('绑定设备 / machineId'), true)
  assert.equal(html.includes('MAC-001'), true)
  assert.equal(html.includes('未绑定'), true)
  assert.equal(html.includes('查看 / 管理'), true)
  assert.equal(html.includes('单码管理 · CODE-001'), true)
  assert.equal(html.includes('最终自助换绑：允许（来源：项目级配置）'), true)
  assert.equal(html.includes('最终自助换绑次数上限：2 次（来源：项目级配置）'), true)
  assert.equal(html.includes('自助换绑次数'), true)
  assert.equal(html.includes('单码级覆盖配置'), true)
  assert.equal(html.includes('单码级自助换绑策略'), true)
  assert.equal(html.includes('继承项目级策略（未配置时回退系统级）'), true)
  assert.equal(html.includes('单码级换绑冷却时间（分钟）'), true)
  assert.equal(html.includes('留空则继承项目级策略'), true)
  assert.equal(html.includes('单码级自助换绑次数上限'), true)
  assert.equal(html.includes('0 表示不限制；留空则继承项目级策略'), true)
  assert.equal(html.includes('保存单码级换绑配置'), true)
  assert.equal(html.includes('管理员操作说明（选填）'), true)
  assert.equal(html.includes('用户提交了设备迁移申请'), true)
  assert.equal(html.includes('绑定历史'), true)
  assert.equal(html.includes('管理员审计'), true)
  assert.equal(html.includes('强制解绑'), true)
  assert.equal(html.includes('强制换绑'), true)
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
          managementView: {
            ...createProps().resultsView.managementView,
            selectedCodeId: null,
            selectedCodeTitle: '',
            selectedCodeSubtitle: '',
            bindingDeviceDisplay: '未绑定',
            usedAtDisplay: '-',
            lastBoundAtDisplay: '-',
            lastRebindAtDisplay: '-',
            rebindCountDisplay: '0 次',
            autoRebindCountDisplay: '0 次',
            effectivePolicySummary: [],
            overrideMaxCountValue: '',
            bindingHistoryEntries: [],
            adminAuditEntries: [],
          },
        },
      }),
    ),
  )

  assert.equal(
    emptyHtml.includes('暂无匹配的激活码记录，建议切换到“筛选与导出”检查关键词、项目或套餐条件。'),
    true,
  )
  assert.equal(emptyHtml.includes('选择一条激活码后，可在弹框中查看绑定设备、最终生效策略并执行强制解绑或换绑。'), false)
})
