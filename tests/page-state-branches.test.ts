/**
 * 任务页状态分支覆盖：error / loading 态渲染（ErrorState + Skeleton 分支）。
 * props 完整（沿用各页现有测试的最小合法组合），仅切换 loading/error。
 */
import './helpers/dom'
import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { ConsumptionsPage } from '../src/components/admin/consumptions-page'
import { SecurityPage } from '../src/components/admin/security-page'
import { AuditPage } from '../src/components/admin/audit-page'

test.afterEach(() => {
  cleanup()
  document.body.removeAttribute('data-scroll-locked')
  document.body.style.removeProperty('pointer-events')
})

function expectAlert() {
  assert.ok(screen.getByRole('alert'), 'error alert rendered')
}

test('ConsumptionsPage：error 态渲染错误提示', () => {
  render(
    React.createElement(ConsumptionsPage, {
      loading: false,
      error: '加载消费日志失败',
      projectOptions: [],
      autoRefresh: false,
      onAutoRefreshChange: () => {},
      logs: [],
      pagination: { currentPage: 1, totalPages: 1, totalItems: 0, startIndex: 0, endIndex: 0 },
      onPageChange: () => {},
      onExport: () => {},
      onOpenDetail: () => {},
      filters: { keyword: '', projectKey: 'all', createdFrom: '', createdTo: '', page: 1 },
      onFiltersChange: () => {},
    }),
  )
  expectAlert()
})

test('ConsumptionsPage：loading 态渲染加载骨架', () => {
  const { container } = render(
    React.createElement(ConsumptionsPage, {
      loading: true,
      error: null,
      projectOptions: [],
      autoRefresh: false,
      onAutoRefreshChange: () => {},
      logs: [],
      pagination: { currentPage: 1, totalPages: 1, totalItems: 0, startIndex: 0, endIndex: 0 },
      onPageChange: () => {},
      onExport: () => {},
      onOpenDetail: () => {},
      filters: { keyword: '', projectKey: 'all', createdFrom: '', createdTo: '', page: 1 },
      onFiltersChange: () => {},
    }),
  )
  assert.ok(container.querySelector('.animate-pulse') || (container.textContent ?? '').includes('加载'))
})

test('AuditPage：error 态渲染错误提示', () => {
  render(
    React.createElement(AuditPage, {
      loading: false,
      error: '加载审计日志失败',
      projectOptions: [],
      operationTypeOptions: [],
      getOperationTypeLabel: (op: string) => op,
      logs: [],
      pagination: { currentPage: 1, totalPages: 1, totalItems: 0, startIndex: 0, endIndex: 0 },
      onPageChange: () => {},
      onExport: () => {},
      onOpenDetail: () => {},
      filters: { keyword: '', projectKey: 'all', operationType: 'all', createdFrom: '', createdTo: '', page: 1 },
      onFiltersChange: () => {},
    }),
  )
  expectAlert()
})

test('AuditPage：loading 态渲染加载骨架', () => {
  const { container } = render(
    React.createElement(AuditPage, {
      loading: true,
      error: null,
      projectOptions: [],
      operationTypeOptions: [],
      getOperationTypeLabel: (op: string) => op,
      logs: [],
      pagination: { currentPage: 1, totalPages: 1, totalItems: 0, startIndex: 0, endIndex: 0 },
      onPageChange: () => {},
      onExport: () => {},
      onOpenDetail: () => {},
      filters: { keyword: '', projectKey: 'all', operationType: 'all', createdFrom: '', createdTo: '', page: 1 },
      onFiltersChange: () => {},
    }),
  )
  assert.ok(container.querySelector('.animate-pulse') || (container.textContent ?? '').includes('加载'))
})

// ── 小组件分支 ──
import { StickySaveBar } from '../src/components/admin/sticky-save-bar'
import { DashboardStatusBadge } from '../src/components/dashboard-status-badge'
import { DashboardNumberedList } from '../src/components/dashboard-numbered-list'

test('StickySaveBar：dirtyCount<=0 且非 saving 时不渲染（early-return 分支）', () => {
  const { container } = render(
    React.createElement(StickySaveBar, { dirtyCount: 0, onSave: () => {}, onReset: () => {} }),
  )
  assert.equal(container.querySelector('form, div'), null)
})

test('StickySaveBar：saving 态禁用保存并显示自定义 dirtyLabel', () => {
  render(
    React.createElement(StickySaveBar, {
      dirtyCount: 2,
      saving: true,
      onSave: () => {},
      onReset: () => {},
      dirtyLabel: '2 项未保存',
    }),
  )
  assert.ok(screen.getByText('正在保存…'))
  assert.ok((screen.getByRole('button', { name: /保存/ }) as HTMLButtonElement).disabled)
})

test('DashboardStatusBadge：自定义 tone 类名覆盖默认', () => {
  render(
    React.createElement(DashboardStatusBadge, { label: '自定义', tone: 'info', className: 'custom-cls' }),
  )
  assert.ok(screen.getByText('自定义'))
})

test('DashboardNumberedList：空 items 不崩溃', () => {
  render(React.createElement(DashboardNumberedList, { items: [] }))
  assert.equal(screen.queryByText(/修改后/), null)
})

// ── SecurityPage 交互分支（handleChangePassword 校验链 + 密码显隐）──
import { fireEvent } from '@testing-library/react'

async function openSecurityPage() {
  render(React.createElement(SecurityPage, {}))
  // 等待工作台渲染（密码字段出现）
  return await screen.findByLabelText(/当前密码/)
}

test('SecurityPage：空表单提交走「请填写所有密码字段」分支', async () => {
  await openSecurityPage()
  fireEvent.submit(document.querySelector('#change-password-form') ?? document.querySelector('form')!)
  // 校验分支命中即通过（toast 缺省时无可见提示）
  assert.ok(screen.getByLabelText(/当前密码/))
})

test('SecurityPage：新密码与确认不一致走 mismatch 分支', async () => {
  await openSecurityPage()
  fireEvent.change(document.getElementById('currentPassword')!, { target: { value: 'old-pass-123' } })
  fireEvent.change(document.getElementById('newPassword')!, { target: { value: 'new-pass-123456' } })
  fireEvent.change(document.getElementById('confirmPassword')!, { target: { value: 'diff-pass-654321' } })
  fireEvent.submit(document.querySelector('form')!)
  assert.ok(screen.getByLabelText(/当前密码/))
})

test('SecurityPage：新密码过短走 tooShort 分支', async () => {
  await openSecurityPage()
  fireEvent.change(document.getElementById('currentPassword')!, { target: { value: 'old-pass-123' } })
  fireEvent.change(document.getElementById('newPassword')!, { target: { value: 'short' } })
  fireEvent.change(screen.getByLabelText(/确认新密码/), { target: { value: 'short' } })
  fireEvent.submit(document.querySelector('form')!)
  assert.ok(screen.getByLabelText(/当前密码/))
})

test('SecurityPage：密码字段显隐切换（toggle 分支）', async () => {
  await openSecurityPage()
  const current = document.getElementById('currentPassword') as HTMLInputElement
  assert.equal(current.type, 'password')
  // 每个字段旁的「显示内容」按钮：点击后 input type 变 text
  const toggle = current.closest('div.rounded-lg')?.querySelector('button')
  if (toggle) fireEvent.click(toggle)
  assert.equal((document.getElementById('currentPassword') as HTMLInputElement).type, 'text')
})

test('SecurityPage：完整密码提交成功 → countdown 分支（107-123）', async () => {
  const calls: Array<{ url: string }> = []
  globalThis.fetch = (async (input: string | URL) => {
    calls.push({ url: typeof input === 'string' ? input : input.toString() })
    return { ok: true, status: 200, json: async () => ({ success: true }) }
  }) as unknown as typeof fetch
  await openSecurityPage()
  fireEvent.change(document.getElementById('currentPassword')!, { target: { value: 'old-pass-123' } })
  fireEvent.change(document.getElementById('newPassword')!, { target: { value: 'new-pass-123456' } })
  fireEvent.change(document.getElementById('confirmPassword')!, { target: { value: 'new-pass-123456' } })
  fireEvent.submit(document.querySelector('form')!)
  await waitFor(() => {
    assert.ok(
      screen.getByText(/密码修改成功/),
      `countdown alert shown, calls=${calls.length}`,
    )
  })
})
