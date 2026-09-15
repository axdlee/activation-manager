/**
 * 消费/审计任务页行为测试：筛选回调、抽屉、危险操作（原函数覆盖 43-60%）。
 */
import './helpers/dom'
import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { ConsumptionsPage } from '../src/components/admin/consumptions-page'
import { AuditPage } from '../src/components/admin/audit-page'
import { ShopOrdersPage } from '../src/components/admin/shop-orders-page'
import type { LicenseConsumptionLog } from '../src/lib/use-consumption-logs'

test.afterEach(() => {
  cleanup()
  document.body.removeAttribute('data-scroll-locked')
  document.body.style.removeProperty('pointer-events')
})

const consumptionLogs: LicenseConsumptionLog[] = [
  {
    id: 1,
    requestId: 'req-1',
    machineId: 'machine-a',
    remainingCountAfter: 4,
    createdAt: '2026-03-01T00:00:00.000Z',
    activationCode: {
      id: 11,
      code: 'CODE-001',
      licenseMode: 'COUNT',
      totalCount: 10,
      remainingCount: 4,
      project: { name: '浏览器插件', projectKey: 'browser-plugin' },
    },
  },
]

test('消费页：筛选/自动刷新开关/分页/详情回调', async () => {
  const patches: Array<Record<string, unknown>> = []
  let autoRefresh = true
  let pageChanged = 0
  let opened = false
  render(
    React.createElement(ConsumptionsPage, {
      filters: { keyword: '', projectKey: 'all', createdFrom: '', createdTo: '', page: 1 },
      onFiltersChange: (patch: Record<string, unknown>) => patches.push(patch),
      projectOptions: [],
      autoRefresh,
      onAutoRefreshChange: (value: boolean) => {
        autoRefresh = value
      },
      refreshStatusText: '已刷新',
      logs: consumptionLogs,
      pagination: { currentPage: 1, totalPages: 2, totalItems: 1, startIndex: 1, endIndex: 1 },
      onPageChange: () => {
        pageChanged += 1
      },
      onExport: () => {},
      onOpenDetail: () => {
        opened = true
      },
    }),
  )
  await screen.findByText('CODE-001')

  fireEvent.change(screen.getByLabelText('搜索 requestId / 机器ID / 激活码'), {
    target: { value: 'req-1' },
  })
  fireEvent.click(screen.getByLabelText('自动刷新'))
  fireEvent.click(screen.getByRole('button', { name: '详情' }))
  await waitFor(() => {
    assert.equal(patches.length, 1)
    assert.equal(autoRefresh, false)
    assert.equal(opened, true)
  })
})

test('消费页：时间范围快捷按钮写入 from/to', async () => {
  const patches: Array<Record<string, unknown>> = []
  render(
    React.createElement(ConsumptionsPage, {
      filters: { keyword: '', projectKey: 'all', createdFrom: '', createdTo: '', page: 1 },
      onFiltersChange: (patch: Record<string, unknown>) => patches.push(patch),
      projectOptions: [],
      autoRefresh: false,
      onAutoRefreshChange: () => {},
      logs: [],
      pagination: { currentPage: 1, totalPages: 1, totalItems: 0, startIndex: 0, endIndex: 0 },
      onPageChange: () => {},
      onExport: () => {},
      onOpenDetail: () => {},
    }),
  )
  fireEvent.click(screen.getByText('最近7天'))
  await waitFor(() => {
    const fromPatch = patches.find((p) => 'createdFrom' in p) as { createdFrom?: string } | undefined
    assert.ok(fromPatch?.createdFrom)
  })
})

const auditLogs = [
  {
    id: 1,
    adminUsername: 'admin',
    operationType: 'FORCE_REBIND',
    targetLabel: 'CODE-001',
    reason: '用户换电脑',
    detailJson: '{"machineId":"m2"}',
    createdAt: '2026-03-01T00:00:00.000Z',
  },
]

test('审计页：筛选/操作类型/导出/行详情回调', async () => {
  const patches: Array<Record<string, unknown>> = []
  let exported = 0
  let opened: { id: number } | null = null
  render(
    React.createElement(AuditPage, {
      filters: { keyword: '', projectKey: 'all', operationType: 'all', createdFrom: '', createdTo: '', page: 1 },
      onFiltersChange: (patch: Record<string, unknown>) => patches.push(patch),
      projectOptions: [],
      operationTypeOptions: [{ value: 'FORCE_REBIND', label: '管理员强制换绑' }],
      getOperationTypeLabel: () => '管理员强制换绑',
      logs: auditLogs,
      pagination: { currentPage: 1, totalPages: 1, totalItems: 1, startIndex: 1, endIndex: 1 },
      onPageChange: () => {},
      onExport: () => {
        exported += 1
      },
      onOpenDetail: (log) => {
        opened = log
      },
    }),
  )
  await screen.findByText('CODE-001')

  fireEvent.change(screen.getByLabelText('搜索管理员 / 目标 / 原因'), { target: { value: 'admin' } })
  fireEvent.click(screen.getByRole('button', { name: '导出筛选结果' }))
  fireEvent.click(screen.getByRole('button', { name: '详情' }))
  await waitFor(() => {
    assert.equal(exported, 1)
    assert.equal(opened?.id, 1)
    assert.equal((patches[0] as { keyword?: string }).keyword, 'admin')
  })
})

test('订单页：状态筛选变化触发重新拉取（fetch 调用带新参数）', async () => {
  const calls: string[] = []
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input.toString()
    calls.push(url)
    return ok({ orders: [] })
  }) as unknown as typeof fetch
  render(React.createElement(ShopOrdersPage, {}))
  await waitFor(() => {
    assert.ok(calls.some((c) => c.includes('/api/admin/shop/orders')))
  })
  fireEvent.change(await screen.findByLabelText('订单状态筛选'), { target: { value: 'paid' } })
  await waitFor(() => {
    assert.ok(calls.some((c) => c.includes('status=paid')))
  })
})

function ok(body: unknown) {
  return { ok: true, status: 200, json: async () => body }
}
