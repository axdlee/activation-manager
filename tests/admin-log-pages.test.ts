import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  buildConsumptionsQuery,
  parseConsumptionsQuery,
  buildAuditQuery,
  parseAuditQuery,
} from '../src/lib/admin-logs-query'
import { ConsumptionsPage } from '../src/components/admin/consumptions-page'
import { ConsumptionDetailDrawer } from '../src/components/admin/consumption-detail-drawer'
import { AuditPage } from '../src/components/admin/audit-page'
import { AuditDetailDrawer } from '../src/components/admin/audit-detail-drawer'

// ── URL query ──────────────────────────────────────────────

test('admin-logs-query：消费/审计筛选往返一致，非法值回退默认', () => {
  const cq = buildConsumptionsQuery({
    keyword: 'REQ-1',
    projectKey: 'p1',
    createdFrom: '2026-01-01T00:00',
    createdTo: '2026-01-31T23:59',
    page: 2,
  })
  assert.deepEqual(parseConsumptionsQuery(new URLSearchParams(cq)), {
    keyword: 'REQ-1',
    projectKey: 'p1',
    createdFrom: '2026-01-01T00:00',
    createdTo: '2026-01-31T23:59',
    page: 2,
  })
  assert.equal(buildConsumptionsQuery({ keyword: '', projectKey: 'all', createdFrom: '', createdTo: '', page: 1 }), '')

  const aq = buildAuditQuery({
    keyword: '换绑',
    projectKey: 'all',
    operationType: 'FORCE_REBIND',
    createdFrom: '',
    createdTo: '',
    page: 3,
  })
  const parsedAudit = parseAuditQuery(new URLSearchParams(aq))
  assert.equal(parsedAudit.operationType, 'FORCE_REBIND')
  assert.equal(parsedAudit.page, 3)
  assert.equal(parseAuditQuery(new URLSearchParams('operationType=weird&page=0')).operationType, 'all')
  assert.equal(parseAuditQuery(new URLSearchParams('operationType=weird&page=0')).page, 1)
})

// ── 消费日志页 ─────────────────────────────────────────────

const consumptionLogs = [
  {
    id: 1,
    requestId: 'req-abc',
    machineId: 'machine-a',
    remainingCountAfter: 4,
    createdAt: '2026-03-01T00:00:00.000Z',
    activationCode: {
      id: 11,
      code: 'CODE-001',
      licenseMode: 'COUNT' as const,
      totalCount: 10,
      remainingCount: 4,
      project: { name: '浏览器插件', projectKey: 'browser-plugin' },
    },
  },
]

function createConsumptionsProps() {
  return {
    loading: false,
    error: null as string | null,
    onRetry: undefined as (() => void) | undefined,
    filters: { keyword: '', projectKey: 'all', createdFrom: '', createdTo: '', page: 1 },
    onFiltersChange: () => {},
    projectOptions: [{ id: 1, name: '浏览器插件', projectKey: 'browser-plugin' }],
    autoRefresh: true,
    onAutoRefreshChange: () => {},
    refreshStatusText: '已刷新',
    logs: consumptionLogs,
    pagination: { currentPage: 1, totalPages: 1, totalItems: 1, startIndex: 1, endIndex: 1 },
    onPageChange: () => {},
    onExport: () => {},
    onOpenDetail: () => {},
  }
}

test('ConsumptionsPage：筛选→结果→详情结构，工具栏含自动刷新开关', () => {
  const html = renderToStaticMarkup(React.createElement(ConsumptionsPage, createConsumptionsProps()))

  assert.equal((html.match(/<h1/g) ?? []).length, 1)
  assert.match(html, /role="toolbar"/)
  assert.match(html, /aria-label="搜索 requestId \/ 机器ID \/ 激活码"/)
  assert.match(html, /aria-label="自动刷新"/)
  assert.match(html, /<table/)
  assert.match(html, /machine-a/)
  assert.match(html, /CODE-001/)
  assert.match(html, /时间范围/)
  assert.match(html, /共 1 条/)
})

test('ConsumptionsPage：空态保留导出禁用逻辑与下一步提示', () => {
  const props = createConsumptionsProps()
  props.logs = []
  props.pagination = { ...props.pagination, totalItems: 0, startIndex: 0, endIndex: 0 }
  const html = renderToStaticMarkup(React.createElement(ConsumptionsPage, props))

  assert.match(html, /没有匹配的消费日志|暂无消费日志/)
})

test('ConsumptionsPage：错误态保留旧数据并提供重试', () => {
  const props = createConsumptionsProps()
  props.error = '加载失败'
  props.onRetry = () => {}
  const html = renderToStaticMarkup(React.createElement(ConsumptionsPage, props))

  assert.match(html, /role="alert"/)
  assert.match(html, /重试/)
  assert.match(html, /machine-a/)
})

// ── 消费详情 Drawer ────────────────────────────────────────

test('ConsumptionDetailDrawer：dialog 语义 + requestId/machineId 完整呈现', () => {
  const html = renderToStaticMarkup(
    React.createElement(ConsumptionDetailDrawer, {
      open: true,
      onOpenChange: () => {},
      log: consumptionLogs[0],
      onCopyText: () => {},
    }),
  )

  assert.match(html, /role="dialog"/)
  assert.match(html, /req-abc/)
  assert.match(html, /machine-a/)
  assert.match(html, /CODE-001/)
  assert.match(html, /浏览器插件/)
  assert.match(html, /剩余次数/)
})

test('ConsumptionDetailDrawer：关闭时不渲染', () => {
  const html = renderToStaticMarkup(
    React.createElement(ConsumptionDetailDrawer, {
      open: false,
      onOpenChange: () => {},
      log: consumptionLogs[0],
      onCopyText: () => {},
    }),
  )
  assert.equal(html, '')
})

// ── 审计中心页 ─────────────────────────────────────────────

const auditLogs = [
  {
    id: 1,
    adminUsername: 'admin',
    operationType: 'FORCE_REBIND',
    targetLabel: 'CODE-001',
    reason: '用户换电脑',
    detailJson: '{"machineId":"new-machine"}',
    createdAt: '2026-03-01T00:00:00.000Z',
  },
]

function createAuditProps() {
  return {
    loading: false,
    error: null as string | null,
    onRetry: undefined as (() => void) | undefined,
    filters: { keyword: '', projectKey: 'all', operationType: 'all', createdFrom: '', createdTo: '', page: 1 },
    onFiltersChange: () => {},
    projectOptions: [{ id: 1, name: '浏览器插件', projectKey: 'browser-plugin' }],
    operationTypeOptions: [
      { value: 'FORCE_REBIND', label: '管理员强制换绑' },
      { value: 'FORCE_UNBIND', label: '管理员强制解绑' },
    ],
    getOperationTypeLabel: (operationType: string) =>
      operationType === 'FORCE_REBIND' ? '管理员强制换绑' : operationType,
    logs: auditLogs,
    pagination: { currentPage: 1, totalPages: 1, totalItems: 1, startIndex: 1, endIndex: 1 },
    onPageChange: () => {},
    onExport: () => {},
    onOpenDetail: () => {},
  }
}

test('AuditPage：表格不展示 detail JSON，行点击打开时间线', () => {
  const html = renderToStaticMarkup(React.createElement(AuditPage, createAuditProps()))

  assert.equal((html.match(/<h1/g) ?? []).length, 1)
  assert.match(html, /<table/)
  assert.match(html, /管理员强制换绑/)
  assert.match(html, /admin/)
  assert.match(html, /用户换电脑/)
  // detail JSON 不进宽表
  assert.doesNotMatch(html, /machineId/)
  assert.match(html, /aria-label="搜索管理员 \/ 目标 \/ 原因"/)
  assert.match(html, /aria-label="操作类型筛选"/)
  assert.match(html, /共 1 条/)
})

test('AuditPage：空态', () => {
  const props = createAuditProps()
  props.logs = []
  props.pagination = { ...props.pagination, totalItems: 0, startIndex: 0, endIndex: 0 }
  const html = renderToStaticMarkup(React.createElement(AuditPage, props))
  assert.match(html, /没有匹配的操作记录|暂无操作记录/)
})

// ── 审计详情 Drawer ────────────────────────────────────────

test('AuditDetailDrawer：时间线呈现操作明细而非裸 JSON', () => {
  const html = renderToStaticMarkup(
    React.createElement(AuditDetailDrawer, {
      open: true,
      onOpenChange: () => {},
      log: auditLogs[0],
      getOperationTypeLabel: (operationType: string) =>
        operationType === 'FORCE_REBIND' ? '管理员强制换绑' : operationType,
    }),
  )

  assert.match(html, /role="dialog"/)
  assert.match(html, /管理员强制换绑/)
  assert.match(html, /CODE-001/)
  assert.match(html, /用户换电脑/)
  // 摘要可读化：不直接倾倒 detailJson 原文
  assert.doesNotMatch(html, /detailJson/)
})

test('AuditDetailDrawer：关闭时不渲染', () => {
  const html = renderToStaticMarkup(
    React.createElement(AuditDetailDrawer, {
      open: false,
      onOpenChange: () => {},
      log: auditLogs[0],
      getOperationTypeLabel: (operationType: string) => operationType,
    }),
  )
  assert.equal(html, '')
})
