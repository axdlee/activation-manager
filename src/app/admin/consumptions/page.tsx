'use client'

import * as React from 'react'
import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { AdminShell } from '@/components/admin/admin-shell'
import { ConsumptionsPage } from '@/components/admin/consumptions-page'
import { ConsumptionDetailDrawer } from '@/components/admin/consumption-detail-drawer'
import {
  buildConsumptionsQuery,
  parseConsumptionsQuery,
  type ConsumptionsQueryState,
} from '@/lib/admin-logs-query'
import {
  buildConsumptionQueryParams,
  type ConsumptionQueryFilters,
} from '@/lib/consumption-query-params'
import { buildExportUrl, triggerFileDownload } from '@/lib/download-utils'
import { getConsumptionRefreshStatusText } from '@/lib/consumption-refresh-status'
import { useConsumptionLogs, type LicenseConsumptionLog } from '@/lib/use-consumption-logs'
import { useDashboardData } from '@/lib/use-dashboard-data'

const PAGE_SIZE = 10

function AdminConsumptionsContainer() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const filters = React.useMemo(() => parseConsumptionsQuery(searchParams), [searchParams])
  const filtersKey = JSON.stringify(filters)

  const [autoRefresh, setAutoRefresh] = React.useState(true)
  const [detailLog, setDetailLog] = React.useState<LicenseConsumptionLog | null>(null)
  const consumption = useConsumptionLogs({ pageSize: PAGE_SIZE })
  const { projects, fetchProjects } = useDashboardData()

  React.useEffect(() => {
    void fetchProjects()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const load = React.useCallback(
    (page: number) => {
      return consumption.fetchConsumptionLogs(
        {
          projectKey: filters.projectKey,
          keyword: filters.keyword,
          createdFrom: filters.createdFrom,
          createdTo: filters.createdTo,
        },
        page,
        'manual',
      )
    },
    // consumption.fetchConsumptionLogs 稳定；filters 变化由 filtersKey effect 驱动
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters],
  )

  // 自动刷新开关：开启时筛选变化防抖后自动拉取；关闭时仅手动刷新
  React.useEffect(() => {
    if (!autoRefresh) return
    const timer = setTimeout(() => {
      void load(filters.page)
    }, 400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey, autoRefresh])

  React.useEffect(() => {
    void load(filters.page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey])

  const updateFilters = React.useCallback(
    (patch: Partial<ConsumptionsQueryState>) => {
      const next = { ...filters, ...patch }
      const query = buildConsumptionsQuery(next)
      router.replace(query ? `/admin/consumptions?${query}` : '/admin/consumptions', { scroll: false })
    },
    [filters, router],
  )

  const handleExport = React.useCallback(() => {
    const exportFilters: ConsumptionQueryFilters = {
      projectKey: filters.projectKey,
      keyword: filters.keyword,
      createdFrom: filters.createdFrom,
      createdTo: filters.createdTo,
    }
    triggerFileDownload(
      buildExportUrl('/api/admin/consumptions/export', buildConsumptionQueryParams(exportFilters)),
    )
  }, [filters])

  const startIndex =
    consumption.pagination.total === 0 ? 0 : (consumption.pagination.page - 1) * PAGE_SIZE + 1
  const endIndex = Math.min(consumption.pagination.page * PAGE_SIZE, consumption.pagination.total)

  return (
    <>
      <ConsumptionsPage
        loading={consumption.loading}
        onRetry={() => void load(filters.page)}
        filters={filters}
        onFiltersChange={updateFilters}
        projectOptions={projects}
        autoRefresh={autoRefresh}
        onAutoRefreshChange={setAutoRefresh}
        refreshStatusText={getConsumptionRefreshStatusText({
          isLoading: consumption.loading,
          refreshSource: consumption.refreshSource,
          lastRefreshedAt: consumption.lastRefreshedAt,
          lastError: consumption.refreshError,
        })}
        logs={consumption.logs}
        pagination={{
          currentPage: consumption.pagination.page,
          totalPages: consumption.pagination.totalPages,
          totalItems: consumption.pagination.total,
          startIndex,
          endIndex,
        }}
        onPageChange={(page) => void load(page)}
        onExport={handleExport}
        onOpenDetail={(log) => setDetailLog(log)}
      />

      <ConsumptionDetailDrawer
        open={detailLog !== null}
        onOpenChange={(open) => {
          if (!open) setDetailLog(null)
        }}
        log={detailLog}
        onCopyText={(text) => {
          void navigator.clipboard?.writeText(text).catch(() => undefined)
        }}
      />
    </>
  )
}

export default function AdminConsumptionsPage() {
  return (
    <AdminShell activeTab="consumptions">
      <Suspense fallback={null}>
        <AdminConsumptionsContainer />
      </Suspense>
    </AdminShell>
  )
}
