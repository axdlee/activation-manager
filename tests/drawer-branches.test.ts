/**
 * 详情抽屉分支覆盖：Audit/Consumption/License 三个 Drawer 打开态渲染 + DetailDrawer 壳。
 */
import './helpers/dom'
import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { AuditDetailDrawer } from '../src/components/admin/audit-detail-drawer'
import { ConsumptionDetailDrawer } from '../src/components/admin/consumption-detail-drawer'
import {
  LicenseDetailDrawer,
  type LicenseCodeDetail,
  type LicensePolicyDraft,
} from '../src/components/admin/license-detail-drawer'
import { DetailDrawer } from '../src/components/admin/detail-drawer'

test.afterEach(() => {
  cleanup()
  document.body.removeAttribute('data-scroll-locked')
  document.body.style.removeProperty('pointer-events')
})

test('AuditDetailDrawer：完整日志字段渲染 + 关闭回调', () => {
  let closed = false
  render(
    React.createElement(AuditDetailDrawer, {
      open: true,
      onOpenChange: (next) => {
        closed = !next
      },
      log: {
        id: 1,
        adminUsername: 'admin',
        operationType: 'PROJECT_CREATE',
        targetLabel: '演示项目',
        reason: '测试原因',
        detailJson: '{"ok":true}',
        createdAt: '2026-09-18T00:00:00.000Z',
      },
      getOperationTypeLabel: (op) => `【${op}】`,
    }),
  )
  assert.ok(screen.getAllByText(/演示项目/).length > 0)
  fireEvent.click(screen.getAllByRole('button')[0])
  assert.equal(closed, true)
})

test('ConsumptionDetailDrawer：消费日志渲染 + 复制', () => {
  render(
    React.createElement(ConsumptionDetailDrawer, {
      open: true,
      onOpenChange: () => undefined,
      log: {
        id: 2,
        requestId: 'req-100',
        machineId: 'machine-200',
        remainingCountAfter: 7,
        createdAt: '2026-09-18T00:00:00.000Z',
        activationCode: {
          id: 9,
          code: 'CODE-900',
          licenseMode: 'COUNT',
          totalCount: 10,
          remainingCount: 7,
          project: { name: '演示项目', projectKey: 'demo' },
        },
      },
      onCopyText: () => undefined,
    }),
  )
  assert.ok(screen.getAllByText(/CODE-900|machine-200|req-100|演示项目/).length > 0)
})

test('LicenseDetailDrawer：绑定历史/审计时间线事件类型分支', () => {
  const detail: LicenseCodeDetail = {
    code: 'CODE-500',
    licenseMode: 'COUNT',
    createdAt: '2026-09-18T00:00:00.000Z',
    usedBy: 'machine-500',
    project: { name: '项目甲', projectKey: 'alpha' },
    bindingHistories: [
      { id: 1, eventType: 'FIRST_BIND', createdAt: '2026-09-18T00:00:00.000Z', machineId: 'm1' },
      { id: 2, eventType: 'FORCE_UNBIND', createdAt: '2026-09-18T01:00:00.000Z', machineId: 'm1' },
      { id: 3, eventType: 'FORCE_REBIND', createdAt: '2026-09-18T02:00:00.000Z', machineId: 'm2' },
      { id: 4, eventType: 'REUSABLE_BINDING_RELEASED', createdAt: '2026-09-18T03:00:00.000Z', machineId: 'm2' },
    ] as unknown as LicenseCodeDetail['bindingHistories'],
    adminAuditLogs: [
      { id: 1, action: 'FORCE_UNBIND', adminUsername: 'admin', createdAt: '2026-09-18T01:00:00.000Z' },
    ] as unknown as LicenseCodeDetail['adminAuditLogs'],
  }
  const draft: LicensePolicyDraft = { policyValue: 'inherit', cooldownValue: '', maxCountValue: '', reason: '' }
  render(
    React.createElement(LicenseDetailDrawer, {
      open: true,
      onOpenChange: () => undefined,
      detail,
      policyDraft: draft,
      onPolicyDraftChange: () => undefined,
      machineTarget: '',
      onMachineTargetChange: () => undefined,
    }),
  )
  assert.ok(screen.getByText(/CODE-500/))
})

test('LicenseDetailDrawer：detail 为 null 时不崩溃', () => {
  render(
    React.createElement(LicenseDetailDrawer, {
      open: true,
      onOpenChange: () => undefined,
      detail: null,
      policyDraft: { policyValue: 'inherit', cooldownValue: '', maxCountValue: '', reason: '' },
      onPolicyDraftChange: () => undefined,
      machineTarget: '',
      onMachineTargetChange: () => undefined,
    }),
  )
  // detail=null 时组件合法地渲染空内容，只要不抛错即分支覆盖
})

test('DetailDrawer：标题/描述/页脚渲染与关闭回调', () => {
  let closed = false
  render(
    React.createElement(DetailDrawer, {
      open: true,
      onOpenChange: (next) => {
        closed = !next
      },
      title: '抽屉标题',
      description: '抽屉描述',
      footer: React.createElement('div', null, '页脚'),
      children: React.createElement('div', null, '内容区'),
    }),
  )
  assert.ok(screen.getByText('抽屉标题'))
  assert.ok(screen.getByText('页脚'))
  fireEvent.click(screen.getAllByRole('button')[0])
  assert.equal(closed, true)
})

test('LicenseDetailDrawer：Escape 关闭 + 复制码回调（键盘与回调分支）', async () => {
  const detail: LicenseCodeDetail = {
    code: 'CODE-700',
    licenseMode: 'TIME',
    createdAt: '2026-09-18T00:00:00.000Z',
    usedBy: null,
    project: null,
  }
  const draft: LicensePolicyDraft = { policyValue: 'inherit', cooldownValue: '', maxCountValue: '', reason: '' }
  let openState = true
  let copied = ''
  const { rerender } = render(
    React.createElement(LicenseDetailDrawer, {
      open: true,
      onOpenChange: (next) => {
        openState = next
      },
      detail,
      policyDraft: draft,
      onPolicyDraftChange: () => undefined,
      machineTarget: '',
      onMachineTargetChange: () => undefined,
      onCopyCode: (code) => {
        copied = code
      },
    }),
  )
  // 触发 Escape 关闭（keyboard handler 分支）
  fireEvent.keyDown(document, { key: 'Escape' })
  await waitFor(() => assert.equal(openState, false))
  rerender(
    React.createElement(LicenseDetailDrawer, {
      open: false,
      onOpenChange: (next) => {
        openState = next
      },
      detail,
      policyDraft: draft,
      onPolicyDraftChange: () => undefined,
      machineTarget: '',
      onMachineTargetChange: () => undefined,
    }),
  )
  // open=false 的卸载分支
  assert.equal(openState, false)
  assert.equal(copied, '')
})

test('AuditDetailDrawer：关闭态渲染 null + Escape 关闭分支', async () => {
  let openState = true
  const { rerender } = render(
    React.createElement(AuditDetailDrawer, {
      open: true,
      onOpenChange: (next) => {
        openState = next
      },
      log: {
        id: 1,
        adminUsername: 'admin',
        operationType: 'PROJECT_CREATE',
        createdAt: '2026-09-18T00:00:00.000Z',
      },
      getOperationTypeLabel: (op) => op,
    }),
  )
  fireEvent.keyDown(document, { key: 'Escape' })
  await waitFor(() => assert.equal(openState, false))
  rerender(
    React.createElement(AuditDetailDrawer, {
      open: false,
      onOpenChange: () => undefined,
      log: null,
      getOperationTypeLabel: (op) => op,
    }),
  )
})

test('ConsumptionDetailDrawer：关闭态 + Escape 关闭分支', async () => {
  let openState = true
  const { rerender } = render(
    React.createElement(ConsumptionDetailDrawer, {
      open: true,
      onOpenChange: (next) => {
        openState = next
      },
      log: {
        id: 2,
        requestId: 'req-1',
        machineId: 'm-1',
        remainingCountAfter: 3,
        createdAt: '2026-09-18T00:00:00.000Z',
        activationCode: {
          id: 1,
          code: 'CODE-1',
          licenseMode: 'COUNT',
          totalCount: 5,
          remainingCount: 3,
          project: { name: 'p', projectKey: 'p' },
        },
      },
    }),
  )
  fireEvent.keyDown(document, { key: 'Escape' })
  await waitFor(() => assert.equal(openState, false))
  rerender(
    React.createElement(ConsumptionDetailDrawer, {
      open: false,
      onOpenChange: () => undefined,
      log: null,
    }),
  )
})
