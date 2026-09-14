'use client'

import * as React from 'react'
import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { AdminShell } from '@/components/admin/admin-shell'
import { AuditPage, type AuditPageLog } from '@/components/admin/audit-page'
import { AuditDetailDrawer } from '@/components/admin/audit-detail-drawer'
import { buildAuditQuery, parseAuditQuery, type AuditQueryState } from '@/lib/admin-logs-query'
import {
  adminAuditOperationTypeOptions,
  getAdminOperationTypeLabel,
} from '@/lib/admin-audit-log-ui'
import { useAdminAuditLogs, type AuditLogQueryFilters } from '@/lib/use-admin-audit-logs'
import { buildExportUrl, triggerFileDownload } from '@/lib/download-utils'
import { useDashboardData } from '@/lib/use-dashboard-data'
import { useI18n } from '@/lib/i18n/i18n-provider'

const PAGE_SIZE = 10

function AdminAuditContainer() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useI18n()

  const filters = React.useMemo(() => parseAuditQuery(searchParams), [searchParams])
  const filtersKey = JSON.stringify(filters)

  const audit = useAdminAuditLogs({ pageSize: PAGE_SIZE })
  const [detailLog, setDetailLog] = React.useState<AuditPageLog | null>(null)
  const { projects, fetchProjects } = useDashboardData()

  React.useEffect(() => {
    void fetchProjects()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const load = React.useCallback(
    (page: number) => {
      return audit.fetchAdminAuditLogs(
        {
          keyword: filters.keyword,
          projectKey: filters.projectKey,
          operationType: filters.operationType,
          createdFrom: filters.createdFrom,
          createdTo: filters.createdTo,
        },
        page,
      )
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters],
  )

  React.useEffect(() => {
    void load(filters.page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey])

  const updateFilters = React.useCallback(
    (patch: Partial<AuditQueryState>) => {
      const next = { ...filters, ...patch }
      const query = buildAuditQuery(next)
      router.replace(query ? `/admin/audit?${query}` : '/admin/audit', { scroll: false })
    },
    [filters, router],
  )

  const handleExport = React.useCallback(() => {
    const exportFilters: AuditLogQueryFilters = {
      keyword: filters.keyword,
      projectKey: filters.projectKey,
      operationType: filters.operationType,
      createdFrom: filters.createdFrom,
      createdTo: filters.createdTo,
    }
    const params = new URLSearchParams()
    if (exportFilters.projectKey !== 'all') params.set('projectKey', exportFilters.projectKey)
    if (exportFilters.keyword.trim()) params.set('keyword', exportFilters.keyword.trim())
    if (exportFilters.operationType !== 'all') params.set('operationType', exportFilters.operationType)
    if (exportFilters.createdFrom) params.set('createdFrom', exportFilters.createdFrom)
    if (exportFilters.createdTo) params.set('createdTo', exportFilters.createdTo)

    triggerFileDownload(buildExportUrl('/api/admin/audit-logs/export', params))
  }, [filters])

  const getOperationTypeLabel = React.useCallback(
    (operationType: string) => getAdminOperationTypeLabel(operationType, t),
    [t],
  )

  const startIndex =
    audit.pagination.total === 0 ? 0 : (audit.pagination.page - 1) * PAGE_SIZE + 1
  const endIndex = Math.min(audit.pagination.page * PAGE_SIZE, audit.pagination.total)

  return (
    <>
      <AuditPage
        loading={audit.loading}
        onRetry={() => void load(filters.page)}
        filters={filters}
        onFiltersChange={updateFilters}
        projectOptions={projects}
        operationTypeOptions={adminAuditOperationTypeOptions.map((option) => ({
          value: option.value,
          label: option.label,
        }))}
        getOperationTypeLabel={getOperationTypeLabel}
        logs={audit.logs}
        pagination={{
          currentPage: audit.pagination.page,
          totalPages: audit.pagination.totalPages,
          totalItems: audit.pagination.total,
          startIndex,
          endIndex,
        }}
        onPageChange={(page) => void load(page)}
        onExport={handleExport}
        onOpenDetail={(log) => setDetailLog(log)}
      />

      <AuditDetailDrawer
        open={detailLog !== null}
        onOpenChange={(open) => {
          if (!open) setDetailLog(null)
        }}
        log={detailLog}
        getOperationTypeLabel={getOperationTypeLabel}
      />
    </>
  )
}

export default function AdminAuditPage() {
  return (
    <AdminShell activeTab="auditLogs">
      <Suspense fallback={null}>
        <AdminAuditContainer />
      </Suspense>
    </AdminShell>
  )
}
