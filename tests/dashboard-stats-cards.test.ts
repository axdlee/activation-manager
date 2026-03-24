import assert from 'node:assert/strict'
import test from 'node:test'

import { buildDashboardStatsCards } from '../src/lib/dashboard-stats-cards'

test('buildDashboardStatsCards 会返回包含次数剩余和次数消耗的 6 张统计卡片', () => {
  const cards = buildDashboardStatsCards({
    total: 10,
    used: 3,
    expired: 1,
    active: 6,
    countRemainingTotal: 18,
    countConsumedTotal: 7,
  })

  assert.deepEqual(cards, [
    { icon: '总', label: '总激活码数', value: 10, color: 'bg-blue-500' },
    { icon: '用', label: '已使用', value: 3, color: 'bg-green-500' },
    { icon: '期', label: '已过期', value: 1, color: 'bg-red-500' },
    { icon: '活', label: '可用激活码', value: 6, color: 'bg-purple-500' },
    { icon: '余', label: '次数剩余', value: 18, color: 'bg-amber-500' },
    { icon: '耗', label: '次数消耗', value: 7, color: 'bg-slate-600' },
  ])
})
