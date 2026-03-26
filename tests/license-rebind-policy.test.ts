import assert from 'node:assert/strict'
import test from 'node:test'

import {
  formatAutoRebindMaxCountLabel,
  formatCooldownMinutesLabel,
  getNextAllowedAutoRebindAt,
  resolveEffectiveRebindPolicy,
  toRebindOverrideSelectValue,
  fromRebindOverrideSelectValue,
} from '../src/lib/license-rebind-policy'

test('resolveEffectiveRebindPolicy 会按 系统 < 项目 < 单码 优先级解析', () => {
  const policy = resolveEffectiveRebindPolicy(
    {
      allowAutoRebind: null,
      autoRebindCooldownMinutes: 30,
      autoRebindMaxCount: null,
      project: {
        allowAutoRebind: true,
        autoRebindCooldownMinutes: 120,
        autoRebindMaxCount: 2,
      },
    },
    {
      allowAutoRebind: false,
      autoRebindCooldownMinutes: 1440,
      autoRebindMaxCount: 0,
    },
  )

  assert.deepEqual(policy, {
    allowAutoRebind: true,
    allowAutoRebindSource: 'project',
    autoRebindCooldownMinutes: 30,
    autoRebindCooldownMinutesSource: 'code',
    autoRebindMaxCount: 2,
    autoRebindMaxCountSource: 'project',
  })
})

test('rebind policy 工具函数会处理 select 值、冷却时间文案、换绑次数上限文案与下次可换绑时间', () => {
  assert.equal(toRebindOverrideSelectValue(true), 'enabled')
  assert.equal(toRebindOverrideSelectValue(false), 'disabled')
  assert.equal(toRebindOverrideSelectValue(null), 'inherit')
  assert.equal(fromRebindOverrideSelectValue('enabled'), true)
  assert.equal(fromRebindOverrideSelectValue('disabled'), false)
  assert.equal(fromRebindOverrideSelectValue('inherit'), null)
  assert.equal(formatCooldownMinutesLabel(0), '立即可换绑')
  assert.equal(formatCooldownMinutesLabel(180), '3 小时')
  assert.equal(formatCooldownMinutesLabel(1440), '1 天')
  assert.equal(formatAutoRebindMaxCountLabel(0), '不限制')
  assert.equal(formatAutoRebindMaxCountLabel(3), '3 次')
  assert.equal(formatAutoRebindMaxCountLabel(null), '继承上级')

  const nextAt = getNextAllowedAutoRebindAt(
    {
      lastBoundAt: new Date('2026-03-26T00:00:00.000Z'),
    },
    90,
  )

  assert.equal(nextAt?.toISOString(), '2026-03-26T01:30:00.000Z')
})
