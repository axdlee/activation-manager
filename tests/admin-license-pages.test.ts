import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  ADMIN_LICENSES_DEFAULT_FILTER_STATE,
  buildAdminLicensesFilterQuery,
  parseAdminLicensesFilterQuery,
} from '../src/lib/admin-licenses-query'
import { LicenseGenerationPage } from '../src/components/admin/license-generation-page'
import { LicenseFilterToolbar } from '../src/components/admin/license-filter-toolbar'
import { LicenseDetailDrawer } from '../src/components/admin/license-detail-drawer'
import { LicensesPage } from '../src/components/admin/licenses-page'
import { cardTypes } from '../src/lib/dashboard-page-types'

// ── 筛选 query ─────────────────────────────────────────────

test('admin-licenses-query：默认状态构建为空 query，往返一致', () => {
  assert.equal(buildAdminLicensesFilterQuery(ADMIN_LICENSES_DEFAULT_FILTER_STATE), '')

  const query = buildAdminLicensesFilterQuery({
    keyword: 'ABC-123',
    status: 'used',
    projectKey: 'browser-plugin',
    cardType: '月卡',
    page: 2,
  })
  const parsed = parseAdminLicensesFilterQuery(new URLSearchParams(query))
  assert.deepEqual(parsed, {
    keyword: 'ABC-123',
    status: 'used',
    projectKey: 'browser-plugin',
    cardType: '月卡',
    page: 2,
  })
})

test('admin-licenses-query：非法 status/page 回退默认，cardType 透传', () => {
  const parsed = parseAdminLicensesFilterQuery(
    new URLSearchParams('status=weird&page=0&cardType=weird&projectKey=&keyword='),
  )
  assert.equal(parsed.status, 'all')
  assert.equal(parsed.page, 1)
  assert.equal(parsed.keyword, '')
  // cardType 为动态枚举（随数据变化），仅原样透传交服务端过滤
  assert.equal(parsed.cardType, 'weird')
})

// ── 生成页 ─────────────────────────────────────────────────

const projects = [
  { id: 1, name: '默认项目', projectKey: 'default', isEnabled: true },
  {
    id: 2,
    name: '浏览器插件',
    projectKey: 'browser-plugin',
    isEnabled: false,
  },
]

function createGenerationProps(
  overrides: Partial<React.ComponentProps<typeof LicenseGenerationPage>> = {},
) {
  return {
    loading: false,
    projects,
    form: {
      selectedProjectKey: 'default',
      onProjectKeyChange: () => {},
      licenseMode: 'TIME' as const,
      onLicenseModeChange: () => {},
      amount: 1,
      onAmountChange: () => {},
      selectedCardType: '',
      onCardTypeChange: () => {},
      expiryDaysValue: 30,
      onExpiryDaysChange: () => {},
      totalCount: 10,
      onTotalCountChange: () => {},
      rebindPolicyValue: 'inherit',
      onRebindPolicyChange: () => {},
      rebindCooldownMinutesValue: '',
      onRebindCooldownMinutesChange: () => {},
      rebindMaxCountValue: '',
      onRebindMaxCountChange: () => {},
      onSubmit: () => {},
    },
    cardTypes,
    generatedCodes: [],
    onCopyCode: () => {},
    ...overrides,
  }
}

test('LicenseGenerationPage：三段式表单保留既有 DOM 契约', () => {
  const html = renderToStaticMarkup(React.createElement(LicenseGenerationPage, createGenerationProps()))

  // 核心字段
  assert.match(html, /id="generate-selected-project-key"/)
  assert.match(html, /id="generate-license-mode"/)
  assert.match(html, /id="generate-amount"/)
  // TIME 条件字段
  assert.match(html, /id="generate-card-type"/)
  assert.match(html, /id="generate-expiry-days"/)
  // 高级换绑策略（默认折叠）
  assert.match(html, /id="generate-rebind-policy"/)
  assert.match(html, /<details/)
  // 主按钮
  assert.match(html, /生成时间型激活码/)
  // 不写实现说明
  assert.doesNotMatch(html, /更圆润/)
  // 停用项目不可选
  assert.match(html, /browser-plugin[^\n]*已停用|已停用/)
})

test('LicenseGenerationPage：COUNT 模式切换为总次数字段', () => {
  const html = renderToStaticMarkup(
    React.createElement(
      LicenseGenerationPage,
      createGenerationProps({
        form: {
          ...createGenerationProps().form,
          licenseMode: 'COUNT',
        },
      }),
    ),
  )

  assert.match(html, /id="generate-total-count"/)
  assert.match(html, /生成次数型激活码/)
  assert.doesNotMatch(html, /id="generate-card-type"/)
})

test('LicenseGenerationPage：选中套餐后有效期禁用，自定义后启用', () => {
  const withCard = renderToStaticMarkup(
    React.createElement(
      LicenseGenerationPage,
      createGenerationProps({
        form: { ...createGenerationProps().form, selectedCardType: '月卡' },
      }),
    ),
  )
  const expiryArea = withCard.slice(withCard.indexOf('generate-expiry-days') - 100, withCard.indexOf('generate-expiry-days') + 300)
  assert.match(expiryArea, /disabled=""/)

  const withCustom = renderToStaticMarkup(
    React.createElement(
      LicenseGenerationPage,
      createGenerationProps({
        form: { ...createGenerationProps().form, selectedCardType: '自定义' },
      }),
    ),
  )
  const customArea = withCustom.slice(withCustom.indexOf('generate-expiry-days') - 100, withCustom.indexOf('generate-expiry-days') + 300)
  assert.doesNotMatch(customArea, /disabled=""/)
})

test('LicenseGenerationPage：生成结果区渲染 h2 与等宽激活码', () => {
  const html = renderToStaticMarkup(
    React.createElement(
      LicenseGenerationPage,
      createGenerationProps({
        generatedCodes: [
          {
            id: 1,
            code: 'ABCD-EFGH-JKLM',
            licenseMode: 'TIME',
            createdAt: '2026-03-01T00:00:00.000Z',
          },
        ],
      }),
    ),
  )

  assert.match(html, /<h2[^>]*>本次生成的激活码/)
  assert.match(html, /font-mono[^>]*>ABCD-EFGH-JKLM/)
  assert.match(html, /复制/)
})

// ── 筛选工具栏 ─────────────────────────────────────────────

test('LicenseFilterToolbar：搜索/状态/项目/套餐/导出一行排布', () => {
  const html = renderToStaticMarkup(
    React.createElement(LicenseFilterToolbar, {
      filters: { ...ADMIN_LICENSES_DEFAULT_FILTER_STATE },
      projectOptions: projects,
      availableCardTypes: ['月卡', '年卡'],
      onFiltersChange: () => {},
      onExport: () => {},
      exportDisabled: false,
    }),
  )

  assert.match(html, /role="toolbar"/)
  assert.match(html, /aria-label="搜索激活码或机器ID"/)
  assert.match(html, /aria-label="状态筛选"/)
  assert.match(html, /aria-label="项目筛选"/)
  assert.match(html, /aria-label="套餐类型筛选"/)
  assert.match(html, /导出筛选结果/)
  assert.match(html, /月卡/)
  assert.match(html, /默认项目/)
})

// ── 管理页 ─────────────────────────────────────────────────

function createLicensesPageProps() {
  return {
    loading: false,
    error: null as string | null,
    onRetry: undefined as (() => void) | undefined,
    filters: { ...ADMIN_LICENSES_FILTER_STATE_FIXTURE },
    onFiltersChange: () => {},
    projectOptions: projects,
    availableCardTypes: ['月卡'],
    statusSummary: { unused: 3, inUse: 2, risk: 1 },
    codes: [
      {
        id: 1,
        code: 'ABCD-EFGH-JKLM',
        licenseMode: 'TIME' as const,
        createdAt: '2026-03-01T00:00:00.000Z',
        usedAt: null,
        usedBy: null,
        isUsed: false,
        expiresAt: null,
        validDays: null,
      },
    ],
    pagination: {
      currentPage: 1,
      totalPages: 1,
      totalItems: 1,
      startIndex: 1,
      endIndex: 1,
    },
    onPageChange: () => {},
    onCopyCode: () => {},
    onDeleteRequest: () => {},
    onOpenDetail: () => {},
    onExport: () => {},
    onCleanupRequest: () => {},
  }
}

const ADMIN_LICENSES_FILTER_STATE_FIXTURE = {
  keyword: '',
  status: 'all' as const,
  projectKey: 'all',
  cardType: 'all',
  page: 1,
}

test('LicensesPage：列表优先——单 h1、表格、工具栏、分页摘要', () => {
  const html = renderToStaticMarkup(React.createElement(LicensesPage, createLicensesPageProps()))

  assert.equal((html.match(/<h1/g) ?? []).length, 1)
  assert.match(html, /<table/)
  assert.match(html, /ABCD-EFGH-JKLM/)
  assert.match(html, /role="toolbar"/)
  assert.match(html, /清理过期绑定/)
  assert.match(html, /共 1 条/)
})

test('LicensesPage：空态给出下一步动作', () => {
  const props = createLicensesPageProps()
  props.codes = []
  props.pagination = { ...props.pagination, totalItems: 0, startIndex: 0, endIndex: 0 }
  const html = renderToStaticMarkup(React.createElement(LicensesPage, props))

  assert.match(html, /没有匹配的激活码|还没有激活码/)
})

// ── 详情 Drawer ────────────────────────────────────────────

function createDrawerProps(
  overrides: Partial<React.ComponentProps<typeof LicenseDetailDrawer>> = {},
) {
  return {
    open: true,
    onOpenChange: () => {},
    detail: {
      id: 1,
      code: 'ABCD-EFGH-JKLM',
      licenseMode: 'TIME' as const,
      createdAt: '2026-03-01T00:00:00.000Z',
      usedAt: null,
      usedBy: null,
      allowAutoRebind: true,
      autoRebindCooldownMinutes: 60,
      autoRebindMaxCount: 3,
      bindingHistories: [
        {
          id: 1,
          eventType: 'FIRST_BIND',
          operatorType: 'user',
          operatorUsername: null,
          fromMachineId: null,
          toMachineId: 'machine-a',
          reason: null,
          createdAt: '2026-03-01T01:00:00.000Z',
        },
      ],
      adminAuditLogs: [
        {
          id: 2,
          adminUsername: 'admin',
          operationType: 'CODE_REBIND_POLICY_UPDATE',
          targetLabel: null,
          reason: null,
          detailJson: null,
          createdAt: '2026-03-02T01:00:00.000Z',
        },
      ],
    },
    policyDraft: {
      policyValue: 'enabled',
      cooldownValue: '60',
      maxCountValue: '3',
      reason: '',
    },
    onPolicyDraftChange: () => {},
    policyDirty: true,
    machineTarget: '',
    onMachineTargetChange: () => {},
    loading: false,
    onSavePolicy: () => {},
    onForceUnbind: () => {},
    onForceRebind: () => {},
    onDelete: () => {},
    onCopyCode: () => {},
    ...overrides,
  }
}

test('LicenseDetailDrawer：dialog 语义 + 策略 + 时间线 + 危险操作', () => {
  const html = renderToStaticMarkup(React.createElement(LicenseDetailDrawer, createDrawerProps()))

  assert.match(html, /role="dialog"/)
  assert.match(html, /ABCD-EFGH-JKLM/)
  assert.match(html, /id="license-detail-rebind-policy"/)
  assert.match(html, /id="license-detail-reason"/)
  assert.match(html, /保存策略/)
  assert.match(html, /绑定历史/)
  assert.match(html, /machine-a/)
  assert.match(html, /管理员操作/)
  assert.match(html, /强制解绑/)
  assert.match(html, /强制换绑/)
  assert.match(html, /删除激活码/)
  assert.match(html, /复制/)
})

test('LicenseDetailDrawer：关闭时不渲染', () => {
  const html = renderToStaticMarkup(
    React.createElement(LicenseDetailDrawer, createDrawerProps({ open: false })),
  )
  assert.equal(html, '')
})
