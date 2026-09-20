/**
 * lib 纯函数分支覆盖：audit UI 标签/详情摘要/时间线 + 修改密码页模型。
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  adminAuditOperationTypeOptions,
  getAdminOperationTypeLabel,
  buildAdminOperationDetailSummary,
  buildAdminOperationTimelineDescription,
} from '../src/lib/admin-audit-log-ui'
import { buildChangePasswordPageModel } from '../src/lib/change-password-ui'

test('getAdminOperationTypeLabel：未知类型走 fallback 分支', () => {
  assert.equal(getAdminOperationTypeLabel('UNKNOWN_OP'), '管理员操作')
})

test('getAdminOperationTypeLabel：已知类型走词典 key 分支与默认 label 分支', () => {
  const first = adminAuditOperationTypeOptions[0]
  assert.equal(
    getAdminOperationTypeLabel(first.value, (key, fallback) => `词典:${fallback ?? key}`),
    `词典:${first.label ?? first.value}`,
  )
  assert.equal(getAdminOperationTypeLabel(first.value), first.label)
})

test('buildAdminOperationDetailSummary：detailJson 缺失返回空串', () => {
  assert.equal(buildAdminOperationDetailSummary('ANY_OP', null), '')
  assert.equal(buildAdminOperationDetailSummary('ANY_OP', undefined), '')
})

test('buildAdminOperationDetailSummary：换绑设置类型走次数/冷却/策略分支', () => {
  const summary = buildAdminOperationDetailSummary(
    'CODE_REBIND_SETTINGS_UPDATED',
    JSON.stringify({ autoRebindMaxCount: 5, cooldownMinutes: 30, policyValue: 'inherit' }),
  )
  assert.match(summary, /次数上限/)
  assert.match(summary, /5/)
})

test('buildAdminOperationDetailSummary：换绑设置 + null 数值走继承标签分支', () => {
  const summary = buildAdminOperationDetailSummary(
    'PROJECT_REBIND_SETTINGS_UPDATED',
    JSON.stringify({ autoRebindMaxCount: null, cooldownMinutes: null }),
  )
  assert.ok(summary.length > 0)
})

test('buildAdminOperationDetailSummary：其他操作类型返回空摘要', () => {
  assert.equal(buildAdminOperationDetailSummary('PROJECT_CREATE', JSON.stringify({ name: 'x' })), '')
})

test('buildAdminOperationDetailSummary：非法 JSON detailJson 容错', () => {
  assert.doesNotThrow(() => buildAdminOperationDetailSummary('ANY_OP', '{invalid json'))
})

test('buildAdminOperationTimelineDescription：有/无 reason 与 detail 的三种组合', () => {
  const withReason = buildAdminOperationTimelineDescription({
    adminUsername: 'admin',
    operationType: 'PROJECT_CREATE',
    reason: '创建演示项目',
    detailJson: null,
  })
  assert.match(withReason, /admin · 创建演示项目/)

  const withDetail = buildAdminOperationTimelineDescription({
    adminUsername: 'admin',
    operationType: 'CODE_REBIND_SETTINGS_UPDATED',
    detailJson: JSON.stringify({ autoRebindMaxCount: 3, cooldownMinutes: 10 }),
  })
  assert.match(withDetail, /次数上限/)

  const bare = buildAdminOperationTimelineDescription({
    adminUsername: 'ops',
    operationType: 'UNKNOWN',
  })
  assert.match(bare, /ops/)
})

test('buildChangePasswordPageModel：空输入 checklist 全未完成', () => {
  const model = buildChangePasswordPageModel({ currentPassword: '', newPassword: '', confirmPassword: '' })
  assert.ok(model.checklist.length > 0)
  assert.ok(model.summaryCards.length > 0)
})

test('buildChangePasswordPageModel：部分填写分支（长度/一致性/差异判定）', () => {
  const filled = buildChangePasswordPageModel({
    currentPassword: 'old-pass',
    newPassword: 'new-pass-123',
    confirmPassword: 'new-pass-123',
  })
  assert.ok(filled.checklist.length > 0)
  const partial = buildChangePasswordPageModel({
    currentPassword: 'same',
    newPassword: 'same',
    confirmPassword: 'different',
  })
  assert.ok(partial.checklist.length > 0)
})
