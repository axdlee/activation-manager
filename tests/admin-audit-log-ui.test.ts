import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildAdminOperationDetailSummary,
  buildAdminOperationTimelineDescription,
} from '../src/lib/admin-audit-log-ui'

test('buildAdminOperationDetailSummary 在策略继承时会明确显示继承上级，而不是误判为禁止', () => {
  const summary = buildAdminOperationDetailSummary(
    'CODE_REBIND_SETTINGS_UPDATED',
    JSON.stringify({
      allowAutoRebind: null,
      autoRebindCooldownMinutes: null,
      autoRebindMaxCount: null,
    }),
  )

  assert.match(summary, /次数上限 继承上级/)
  assert.match(summary, /冷却 继承上级/)
  assert.match(summary, /继承上级$/)
})

test('buildAdminOperationTimelineDescription 会拼接管理员、原因与审计详情摘要', () => {
  const description = buildAdminOperationTimelineDescription({
    operationType: 'CODE_FORCE_REBIND',
    adminUsername: 'admin',
    reason: '人工协助迁移',
    detailJson: JSON.stringify({
      fromMachineId: 'old-device',
      toMachineId: 'new-device',
    }),
  })

  assert.equal(description, 'admin · 人工协助迁移 · old-device → new-device')
})
