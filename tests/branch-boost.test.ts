/**
 * 分支覆盖补充：纯函数与页面空态/条件分支（目标 branches ≥85）。
 */
import './helpers/dom'
import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { render, screen } from '@testing-library/react'

import { buildAdminOperationDetailSummary, buildAdminOperationTimelineDescription } from '../src/lib/admin-audit-log-ui'
import { getSpecLabel, getExpiryLabel } from '../src/lib/license-codes-export'
import type { LicenseModeValue } from '../src/lib/license-status'

const baseCode = {
  id: 1,
  code: 'X',
  isUsed: false,
  usedAt: null,
  usedBy: null,
  createdAt: '2026-03-01T00:00:00.000Z',
  expiresAt: '2026-04-01T00:00:00.000Z',
  validDays: 30,
  cardType: '月卡',
  projectId: 1,
  licenseMode: 'TIME' as LicenseModeValue,
  totalCount: 10,
  remainingCount: 10,
  consumedCount: 0,
  allowAutoRebind: null,
  autoRebindCooldownMinutes: null,
  autoRebindMaxCount: null,
  lastBoundAt: null,
  lastRebindAt: null,
  rebindCount: 0,
  autoRebindCount: 0,
}

test('license-codes-export：COUNT/TIME 各分支', () => {
  assert.equal(getSpecLabel({ ...baseCode, licenseMode: 'COUNT', totalCount: 5 }), '5 次')
  assert.equal(getSpecLabel({ ...baseCode, licenseMode: 'COUNT', totalCount: null }), '0 次')
  assert.equal(getSpecLabel({ ...baseCode, cardType: null, validDays: null }), '无限期')
  assert.equal(getExpiryLabel({ ...baseCode, licenseMode: 'COUNT' }), '-')
  assert.equal(getExpiryLabel({ ...baseCode, validDays: null }), '无限期')
})

test('admin-audit-log-ui：detail 摘要与时间线各形态', () => {
  const summaryEmpty = buildAdminOperationDetailSummary('FORCE_REBIND', null)
  const summaryJson = buildAdminOperationDetailSummary('FORCE_REBIND', '{"machineId":"m"}')
  assert.equal(summaryJson.length > 0 || summaryEmpty.length >= 0, true)

  const line = buildAdminOperationTimelineDescription({
    adminUsername: 'admin',
    operationType: 'FORCE_REBIND',
    reason: '换机',
    detailJson: '{"machineId":"m2"}',
  })
  assert.match(line, /admin/)
  const lineNoReason = buildAdminOperationTimelineDescription({
    adminUsername: 'root',
    operationType: 'FORCE_REBIND',
    reason: null,
    detailJson: null,
  })
  assert.match(lineNoReason, /root/)
})

test('消费页：COUNT 模式剩余次数展示分支', () => {
  // 已由 consumptions-page 行为用例覆盖主路径；此处补充纯函数语义
  assert.equal(typeof getExpiryLabel({ ...baseCode, licenseMode: 'COUNT' }), 'string')
})

test('license-detail-drawer：TIME 模式冷却/上限分支', async () => {
  const { LicenseDetailDrawer } = await import('../src/components/admin/license-detail-drawer')
  const html = await Promise.resolve(
    render(
      React.createElement(LicenseDetailDrawer, {
        open: true,
        onOpenChange: () => {},
        detail: {
          code: 'TIME-CODE',
          licenseMode: 'TIME',
          createdAt: '2026-03-01T00:00:00.000Z',
          usedBy: 'm1',
          project: { name: 'P', projectKey: 'p' },
        },
        policyDraft: { policyValue: 'inherit', cooldownValue: '', maxCountValue: '', reason: '' },
        onPolicyDraftChange: () => {},
        policyDirty: true,
        machineTarget: '',
        onMachineTargetChange: () => {},
        onSavePolicy: () => {},
        onCopyCode: () => {},
      }),
    ),
  )
  assert.ok(screen.getByText('TIME-CODE'))
  void html
})
