'use client'

/**
 * AdminOverviewPage — 任务型概览页（Task 3）
 *
 * 数据：独立拉取（stats + audit 前五条 + license API 摘要），与旧 dashboard 完全解耦。
 * 结构：KPI(4) → 使用率/License 指标 → 最近操作。
 */

import * as React from 'react'
import { useRouter } from 'next/navigation'

import { PageHeader } from '@/components/admin/page-header'
import { PageSection } from '@/components/admin/page-section'
import { PageToolbar } from '@/components/admin/page-toolbar'
import { EmptyState } from '@/components/admin/empty-state'
import { ErrorState } from '@/components/admin/error-state'
import { Skeleton } from '@/components/ui-admin/skeleton'
import { Badge } from '@/components/ui-admin/badge'
import { Button } from '@/components/ui-admin/button'
import { useI18n } from '@/lib/i18n/i18n-provider'
import { useDashboardStats } from '@/lib/use-dashboard-stats'
import { useAdminAuditLogs } from '@/lib/use-admin-audit-logs'
import { getAdminOperationTypeLabel } from '@/lib/admin-audit-log-ui'
import { AdminShell } from '@/components/admin/admin-shell'

type MetricsSummary = {
  total: number
  success: number
  failure: number
  rateLimited: number
}

export default function AdminOverviewPage() {
  const { t } = useI18n()
  const router = useRouter()
  const { stats, fetchStats } = useDashboardStats()
  const audit = useAdminAuditLogs()
  const { logs: auditLogs, fetchAdminAuditLogs } = audit

  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [metrics, setMetrics] = React.useState<MetricsSummary | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await Promise.all([
        fetchStats(),
        fetchAdminAuditLogs({ keyword: '', projectKey: 'all', operationType: 'all', createdFrom: '', createdTo: '' }),
        fetch('/api/admin/metrics/license-api')
          .then((r) => r.json())
          .then((d: { metrics?: MetricsSummary }) => {
            if (d.metrics) setMetrics(d.metrics)
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
      auditLogs.slice(0, 5).map((log) => ({
        id: log.id,
        operationType: getAdminOperationTypeLabel(log.operationType),
        adminUsername: log.adminUsername,
        createdAt: log.createdAt,
      })),
    [auditLogs],
  )

  const kpis = [
    { label: t('dash.kpi.total', '总激活码数'), value: stats.total },
    { label: t('dash.kpi.used', '已使用'), value: stats.used },
    { label: t('dash.kpi.active', '可用'), value: stats.active },
    { label: t('dash.kpi.expired', '已过期'), value: stats.expired },
  ]

  return (
    <AdminShell activeTab="stats">
      <PageHeader
        title={t('dash.overview.title', '概览')}
        description={t('dash.overview.desc', '全局发码规模、使用率与最近操作。')}
        actions={
          <PageToolbar
            actions={<Badge variant="secondary">{t('dash.overview.scopeAll', '全部项目')}</Badge>}
          />
        }
      />

      {error ? (
        <ErrorState message={error} retry={() => void load()} />
      ) : loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-32" />
          <Skeleton className="h-48" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="rounded-lg border bg-card px-4 py-4 shadow-sm">
                <p className="text-sm text-muted-foreground">{kpi.label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{kpi.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <PageSection title={t('dash.overview.usageRate', '使用率统计')}>
              <p className="text-3xl font-bold tabular-nums text-foreground">{usageRate}%</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t(
                  'dash.overview.usageRateDesc',
                  `总激活码 ${stats.total} 个，已使用 ${stats.used || 0} 个`,
                )}
              </p>
            </PageSection>
            <PageSection title={t('dash.overview.metrics', 'License API 指标（5 分钟窗口）')}>
              {metrics ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: t('dash.stats.totalReq', '总请求'), value: metrics.total },
                    { label: t('dash.stats.successReq', '成功'), value: metrics.success },
                    { label: t('dash.stats.failedReq', '失败'), value: metrics.failure },
                    { label: t('dash.stats.rateLimited', '限流'), value: metrics.rateLimited },
                  ].map((item) => (
                    <div key={item.label} className="rounded-md border bg-muted/40 px-3 py-2">
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{item.value}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t('dash.overview.noMetrics', '暂无请求数据')}</p>
              )}
            </PageSection>
          </div>

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
                    <li key={op.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
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
