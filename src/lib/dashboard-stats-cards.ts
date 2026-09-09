import type { ProjectStatsSummary } from '@/lib/project-stats-summary'

export type StatsCardTranslate = (key: string, fallback?: string) => string

export type DashboardStatsCard = {
  icon: string
  label: string
  value: number
  color: string
  labelKey?: string
}

export type DashboardStatsOverview = Pick<
  ProjectStatsSummary,
  'total' | 'used' | 'expired' | 'active' | 'countRemainingTotal' | 'countConsumedTotal'
>

export function buildDashboardStatsCards(
  stats: DashboardStatsOverview,
  t?: StatsCardTranslate,
): DashboardStatsCard[] {
  const cards: DashboardStatsCard[] = [
    { icon: '总', label: '总激活码数', value: stats.total, color: 'bg-blue-500', labelKey: 'stats.card.total.label' },
    { icon: '用', label: '已使用', value: stats.used, color: 'bg-green-500', labelKey: 'stats.card.used.label' },
    { icon: '期', label: '已过期', value: stats.expired, color: 'bg-red-500', labelKey: 'stats.card.expired.label' },
    { icon: '活', label: '可用激活码', value: stats.active, color: 'bg-purple-500', labelKey: 'stats.card.active.label' },
    { icon: '余', label: '次数剩余', value: stats.countRemainingTotal, color: 'bg-amber-600', labelKey: 'stats.card.remaining.label' },
    { icon: '耗', label: '次数消耗', value: stats.countConsumedTotal, color: 'bg-slate-600', labelKey: 'stats.card.consumed.label' },
  ]

  if (!t) {
    return cards.map(({ icon, label, value, color }) => ({ icon, label, value, color }))
  }

  return cards.map(({ icon, label, value, color, labelKey }) => ({
    icon,
    label: labelKey ? t(labelKey, label) : label,
    value,
    color,
  }))
}
