'use client'

/**
 * AdminOverviewPage — 数据统计驾驶舱
 *
 * 数据：stats + projectStats（项目级统计）+ 消费趋势（7 天面积图）+ License API 指标。
 * 结构：KPI 行 → 消费趋势面积图 + 激活码构成 donut → API 指标 + 路径分布 → 项目统计明细。
 */

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AlertTriangle, CheckCircle2, Layers, PlayCircle } from 'lucide-react'

import { PageHeader } from '@/components/admin/page-header'
import { PageSection } from '@/components/admin/page-section'
import { EmptyState } from '@/components/admin/empty-state'
import { ErrorState } from '@/components/admin/error-state'
import { Skeleton } from '@/components/ui-admin/skeleton'
import { Badge } from '@/components/ui-admin/badge'
import { Button } from '@/components/ui-admin/button'
import { useI18n } from '@/lib/i18n/i18n-provider'
import { useDashboardStats } from '@/lib/use-dashboard-stats'
import { useConsumptionTrend } from '@/lib/use-consumption-trend'
import { useAdminAuditLogs } from '@/lib/use-admin-audit-logs'
import { getAdminOperationTypeLabel } from '@/lib/admin-audit-log-ui'
import { AdminShell } from '@/components/admin/admin-shell'
import { LicenseMetricsChart, type LicenseMetricPoint } from '@/components/admin/license-metrics-chart'

type MetricsSummary = {
  total: number
  success: number
  failure: number
  rateLimited: number
  successRate?: number
  points?: LicenseMetricPoint[]
}

const DONUT_COLORS = ['hsl(var(--muted-foreground))', 'hsl(var(--primary))', 'hsl(var(--warning))']

export default function AdminOverviewPage() {
  const { t } = useI18n()
  const router = useRouter()
  const { stats, projectStats, fetchStats } = useDashboardStats()
  const audit = useAdminAuditLogs()
  const { logs: auditLogs, fetchAdminAuditLogs } = audit
  const trend = useConsumptionTrend({ defaultDays: 7 })

  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [metrics, setMetrics] = React.useState<MetricsSummary | null>(null)
  const [metricPoints, setMetricPoints] = React.useState<LicenseMetricPoint[]>([])

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await Promise.all([
        fetchStats(),
        fetchAdminAuditLogs({ keyword: '', projectKey: 'all', operationType: 'all', createdFrom: '', createdTo: '' }),
        trend.fetchTrend('all'),
        fetch('/api/admin/metrics/license-api')
          .then((r) => r.json())
          .then((d: { metrics?: MetricsSummary }) => {
            if (d.metrics) {
              setMetrics(d.metrics)
              setMetricPoints(d.metrics.points ?? [])
            }
          })
          .catch(() => setMetrics(null)),
      ])
    } catch {
      setError(t('dash.overview.loadError', '数据加载失败，请重试'))
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const usageRate = stats.total > 0 ? Math.round(((stats.used || 0) / stats.total) * 100) : 0

  const recentOps = React.useMemo(
    () =>
      auditLogs.slice(0, 6).map((log) => ({
        id: log.id,
        operationType: getAdminOperationTypeLabel(log.operationType),
        adminUsername: log.adminUsername,
        createdAt: log.createdAt,
      })),
    [auditLogs],
  )

  const kpis = [
    {
      label: t('dash.kpi.total', '总激活码数'),
      value: stats.total,
      icon: Layers,
      sub: t('dash.kpi.totalSub', '全部项目累计'),
      iconCls: 'bg-primary/10 text-primary',
    },
    {
      label: t('dash.kpi.used', '已使用'),
      value: stats.used,
      icon: CheckCircle2,
      sub: t('dash.kpi.usedSub', '占比 {pct}%').replace('{pct}', String(usageRate)),
      iconCls: 'bg-emerald-500/10 text-emerald-600',
    },
    {
      label: t('dash.kpi.active', '可用'),
      value: stats.active,
      icon: PlayCircle,
      sub: t('dash.kpi.activeSub', '可分配余量'),
      iconCls: 'bg-sky-500/10 text-sky-600',
    },
    {
      label: t('dash.kpi.expired', '已过期'),
      value: stats.expired,
      icon: AlertTriangle,
      sub: t('dash.kpi.expiredSub', '占比 {pct}%').replace(
        '{pct}',
        String(stats.total > 0 ? Math.round(((stats.expired || 0) / stats.total) * 100) : 0),
      ),
      iconCls: 'bg-amber-500/10 text-amber-600',
    },
  ]

  const donutData = [
    { name: t('dash.kpi.active', '可用'), value: stats.active },
    { name: t('dash.kpi.used', '已使用'), value: stats.used },
    { name: t('dash.kpi.expired', '已过期'), value: stats.expired },
  ].filter((d) => d.value > 0)
  const donutColors = [DONUT_COLORS[1], DONUT_COLORS[0], DONUT_COLORS[2]]

  const trendData = React.useMemo(
    () =>
      (trend.trend?.points ?? []).map((point) => ({
        label: point.label,
        count: point.count,
      })),
    [trend.trend],
  )
  const trendTotal = trend.trend?.totalConsumptions ?? 0

  const projectRows = React.useMemo(
    () => projectStats.slice(0, 8),
    [projectStats],
  )

  return (
    <AdminShell activeTab="stats">
      <PageHeader
        title={t('dash.overview.title', '概览')}
        description={t('dash.overview.desc', '全局发码规模、使用趋势与 License API 运行状态。')}
        actions={
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent"
          >
            {t('dash.overview.refresh', '刷新数据')}
          </button>
        }
      />

      {error ? (
        <ErrorState message={error} retry={() => void load()} />
      ) : loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Skeleton className="h-64 lg:col-span-2" />
            <Skeleton className="h-64" />
          </div>
          <Skeleton className="h-72" />
        </div>
      ) : (
        <>
          {/* KPI 行 */}
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {kpis.map((kpi) => {
              const Icon = kpi.icon
              return (
                <div
                  key={kpi.label}
                  className="rounded-lg border bg-card p-4 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground">{kpi.label}</p>
                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${kpi.iconCls}`}>
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                  </div>
                  <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-foreground">
                    {kpi.value}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{kpi.sub}</p>
                </div>
              )
            })}
          </div>

          {/* 趋势 + 构成 */}
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-lg border bg-card p-5 shadow-sm lg:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    {t('dash.overview.trendTitle', '消费趋势（近 7 天）')}
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t('dash.overview.trendDesc', '按天聚合的激活码消费次数')}
                  </p>
                </div>
                <Badge variant="secondary">
                  {t('dash.overview.trendTotal', '合计 {n} 次').replace('{n}', String(trendTotal))}
                </Badge>
              </div>
              <div className="mt-4 h-56">
                {trendData.length === 0 ? (
                  <div className="flex h-full items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                    {t('dash.overview.trendEmpty', '暂无消费数据')}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                      <defs>
                        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.28} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        stroke="hsl(var(--border))"
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        stroke="hsl(var(--border))"
                        tickLine={false}
                      />
                      <RechartsTooltip
                        contentStyle={{
                          background: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 8,
                          fontSize: 12,
                          color: 'hsl(var(--popover-foreground))',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="count"
                        name={t('dash.overview.consumeCount', '消费次数')}
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        fill="url(#trendFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="rounded-lg border bg-card p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground">
                {t('dash.overview.donutTitle', '激活码构成')}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('dash.overview.donutDesc', '可用 / 已使用 / 已过期占比')}
              </p>
              <div className="mt-2 h-44">
                {donutData.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    {t('dash.overview.donutEmpty', '暂无数据')}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="58%"
                        outerRadius="85%"
                        paddingAngle={2}
                        strokeWidth={0}
                      >
                        {donutData.map((entry, index) => (
                          <Cell key={entry.name} fill={donutColors[index % donutColors.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{
                          background: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 8,
                          fontSize: 12,
                          color: 'hsl(var(--popover-foreground))',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <ul className="mt-2 space-y-1.5">
                {donutData.map((entry, index) => (
                  <li key={entry.name} className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: donutColors[index % donutColors.length] }}
                        aria-hidden
                      />
                      {entry.name}
                    </span>
                    <span className="font-medium tabular-nums text-foreground">{entry.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* License API 指标 */}
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-lg border bg-card p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground">
                {t('dash.overview.metricsTitle', 'License API（5 分钟窗口）')}
              </h2>
              {metrics ? (
                <>
                  <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">
                    {metrics.total}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t('dash.overview.metricsTotal', '总请求')}
                  </p>
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t('dash.stats.successReq', '成功')}</span>
                      <span className="font-medium tabular-nums text-foreground">{metrics.success}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t('dash.stats.failedReq', '失败')}</span>
                      <span className="font-medium tabular-nums text-foreground">{metrics.failure}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t('dash.stats.rateLimited', '限流')}</span>
                      <span className="font-medium tabular-nums text-foreground">{metrics.rateLimited}</span>
                    </div>
                    <div className="flex items-center justify-between border-t pt-2">
                      <span className="text-muted-foreground">{t('dash.overview.successRate', '成功率')}</span>
                      <span className="font-semibold tabular-nums text-foreground">
                        {metrics.successRate ?? 0}%
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t('dash.overview.noMetrics', '暂无请求数据')}
                </p>
              )}
            </div>

            <div className="rounded-lg border bg-card p-5 shadow-sm lg:col-span-2">
              <h2 className="text-sm font-semibold text-foreground">
                {t('dash.overview.metricsChartTitle', '接口请求分布')}
              </h2>
              <p className="mb-3 mt-0.5 text-xs text-muted-foreground">
                {t('dash.overview.metricsChartDesc', '按 License API 路径聚合（5 分钟窗口）')}
              </p>
              <LicenseMetricsChart points={metricPoints} height={220} />
            </div>
          </div>

          {/* 项目统计明细 */}
          <div className="mt-6">
            <PageSection
              title={t('dash.overview.projectStatsTitle', '项目统计')}
              actions={
                <Button variant="ghost" size="sm" onClick={() => router.push('/admin/projects')}>
                  {t('dash.overview.manageProjects', '管理项目')}
                </Button>
              }
            >
              {projectRows.length === 0 ? (
                <EmptyState
                  title={t('dash.overview.noProjects', '暂无项目数据')}
                  description={t('dash.overview.noProjectsDesc', '创建项目并生成激活码后，这里会展示项目级统计。')}
                />
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th scope="col" className="px-4 py-2.5 font-medium">
                          {t('dash.overview.colProject', '项目')}
                        </th>
                        <th scope="col" className="px-4 py-2.5 text-right font-medium">
                          {t('dash.overview.colTotal', '总激活码')}
                        </th>
                        <th scope="col" className="px-4 py-2.5 text-right font-medium">
                          {t('dash.overview.colUsed', '已使用')}
                        </th>
                        <th scope="col" className="px-4 py-2.5 text-right font-medium">
                          {t('dash.overview.colExpired', '已过期')}
                        </th>
                        <th scope="col" className="px-4 py-2.5 text-right font-medium">
                          {t('dash.overview.colStatus', '状态')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {projectRows.map((row) => (
                        <tr key={row.id} className="transition hover:bg-muted/30">
                          <td className="max-w-[180px] truncate px-4 py-2.5 font-medium text-foreground">
                            {row.name}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{row.totalCodes}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{row.usedCodes}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{row.expiredCodes}</td>
                          <td className="px-4 py-2.5 text-right">
                            <Badge variant="secondary">
                              {row.isEnabled
                                ? t('dash.overview.enabled', '启用中')
                                : t('dash.overview.disabled', '已停用')}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </PageSection>
          </div>

          {/* 最近操作 */}
          <div className="mt-6">
            <PageSection
              title={t('dash.overview.recentOps', '最近操作')}
              actions={
                <Button variant="ghost" size="sm" onClick={() => router.push('/admin/audit')}>
                  {t('dash.stats.viewAllAudit', '查看全部')}
                </Button>
              }
            >
              {recentOps.length === 0 ? (
                <EmptyState
                  title={t('dash.stats.noOps', '暂无管理员操作记录')}
                  description={t('dash.stats.noOpsDesc', '创建项目、发码或修改配置后，操作会记录在这里。')}
                />
              ) : (
                <ul className="divide-y">
                  {recentOps.map((op) => (
                    <li
                      key={op.id}
                      className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{op.operationType}</p>
                        <p className="text-xs text-muted-foreground">
                          {op.adminUsername} · {new Date(op.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <Badge variant="secondary">{op.operationType}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </PageSection>
          </div>
        </>
      )}
    </AdminShell>
  )
}
