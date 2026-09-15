import React from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui-admin/card'
import { Badge } from '@/components/ui-admin/badge'
import { cn } from '@/lib/utils'
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
  panelClassName?: string
  mutedPanelClassName?: string
}

/**
 * 数据统计总览（shadcn 重构版）
 * - 顶部统计口径条 → 简洁 Badge 行
 * - 统计卡片 → 语义色 shadcn Card（图标 + 大数字 + 描述）
 * - 使用率/洞察 → 双 Card 布局
 */
export function DashboardStatsOverviewPanel({
  statsScopeLabel,
  statsCards,
  countUsageRateText,
  countUsageRateDescription,
  peakConsumptionProjectText,
  peakConsumptionProjectDescription,
}: DashboardStatsOverviewPanelProps) {
  return (
    <div className="space-y-6">
      {/* 统计口径 */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-3">
        <Badge variant="secondary">{countUsageRateText.length > 0 ? '统计口径' : '统计口径'}</Badge>
        <span className="text-sm font-semibold text-foreground">{statsScopeLabel}</span>
        <span className="text-sm text-muted-foreground">
          顶部统计、消费趋势与导出都会跟随这个范围联动。
        </span>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {statsCards.map((card) => (
          <Card key={card.label} className="transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm font-semibold text-white',
                  card.color,
                )}
              >
                {card.icon}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums text-foreground">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 洞察区 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>使用率统计</CardTitle>
            <CardDescription>从全局发码视角观察已使用、过期和可用激活码分布。</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums text-foreground">{countUsageRateText}</div>
            <p className="mt-1 text-sm text-muted-foreground">{countUsageRateDescription}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>运营洞察</CardTitle>
            <CardDescription>提炼当前项目范围内最值得关注的次数型使用信号。</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold text-foreground">{peakConsumptionProjectText}</div>
            <p className="mt-1 text-sm text-muted-foreground">{peakConsumptionProjectDescription}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
