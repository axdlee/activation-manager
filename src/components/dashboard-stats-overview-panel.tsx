import React from 'react'

import { DashboardSummaryCard } from '@/components/dashboard-summary-card'
import type { DashboardStatsCard } from '@/lib/dashboard-stats-cards'
import type { DashboardStatsOverview } from '@/lib/dashboard-stats-cards'

type DashboardStatsOverviewPanelProps = {
  statsScopeLabel: string
  statsCards: DashboardStatsCard[]
  displayStats: DashboardStatsOverview
  countUsageRateText: string
  countUsageRateDescription: string
  peakConsumptionProjectText: string
  peakConsumptionProjectDescription: string
  panelClassName: string
  mutedPanelClassName: string
}

export function DashboardStatsOverviewPanel({
  statsScopeLabel,
  statsCards,
  displayStats,
  countUsageRateText,
  countUsageRateDescription,
  peakConsumptionProjectText,
  peakConsumptionProjectDescription,
  panelClassName,
  mutedPanelClassName,
}: DashboardStatsOverviewPanelProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-brand-500/20 bg-brand-500/10 px-5 py-4 text-sm text-brand-300 shadow-sm">
        <span className="inline-flex items-center rounded-full bg-brand-600/10 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-brand-400">
          当前统计口径
        </span>
        <span className="text-base font-semibold">{statsScopeLabel}</span>
        <span className="text-brand-400/80">顶部统计、消费趋势与导出都会跟随这个范围联动。</span>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {statsCards.map((card) => (
          <div
            key={card.label}
            className="group relative overflow-hidden rounded-lg border border-surface-200/80 bg-surface-100 p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 via-cyan-400 to-indigo-400 opacity-0 transition group-hover:opacity-100" />
            <div className="flex items-center gap-4">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-md ${card.color} shadow-card shadow-slate-200`}>
                <span className="text-base font-semibold text-white">{card.icon}</span>
              </div>
              <div className="min-w-0 flex-1">
                <dl>
                  <dt className="truncate text-sm font-medium text-ink-500">{card.label}</dt>
                  <dd className="mt-1 text-2xl font-semibold tracking-tight text-ink-50">{card.value}</dd>
                </dl>
                <p className="mt-2 text-xs text-ink-500">当前口径：{statsScopeLabel}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className={`${panelClassName} p-6`}>
          <div className="mb-5">
            <h3 className="text-lg font-semibold text-ink-50">使用率统计</h3>
            <p className="mt-1 text-sm text-ink-500">从全局发码视角观察已使用、过期和可用激活码分布。</p>
          </div>
          <div className="space-y-4">
            {[
              ['已使用', displayStats.used, 'bg-green-500'],
              ['已过期', displayStats.expired, 'bg-red-500'],
              ['可用', displayStats.active, 'bg-blue-500'],
            ].map(([label, value, color]) => (
              <div key={label} className={`${mutedPanelClassName} px-4 py-4`}>
                <div className="mb-2 flex justify-between text-sm text-ink-300">
                  <span>{label}</span>
                  <span className="font-semibold text-ink-50">
                    {displayStats.total > 0 ? Math.round((Number(value) / displayStats.total) * 100) : 0}%
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-slate-200">
                  <div
                    className={`${color} h-2.5 rounded-full`}
                    style={{
                      width: `${displayStats.total > 0 ? (Number(value) / displayStats.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <div className="mt-2 text-xs text-ink-500">数量：{value} / {displayStats.total}</div>
              </div>
            ))}
          </div>
        </div>

        <div className={`${panelClassName} p-6`}>
          <div className="mb-5">
            <h3 className="text-lg font-semibold text-ink-50">运营洞察</h3>
            <p className="mt-1 text-sm text-ink-500">提炼当前项目范围内最值得关注的次数型使用信号。</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DashboardSummaryCard
              label="次数使用率"
              value={countUsageRateText}
              description={countUsageRateDescription}
            />
            <DashboardSummaryCard
              label="峰值消费项目"
              value={peakConsumptionProjectText}
              description={peakConsumptionProjectDescription}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
