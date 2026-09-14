'use client'

import * as React from 'react'
import { ChevronDown, RefreshCw, Search } from 'lucide-react'

import { PageHeader } from '@/components/admin/page-header'
import { PageToolbar } from '@/components/admin/page-toolbar'
import { EmptyState } from '@/components/admin/empty-state'
import { ErrorState } from '@/components/admin/error-state'
import { Skeleton } from '@/components/ui-admin/skeleton'
import type { AuditQueryState } from '@/lib/admin-logs-query'
import { useI18n } from '@/lib/i18n/i18n-provider'

export type AuditPageProjectOption = { id: number; name: string; projectKey: string }
export type AuditPageOperationTypeOption = { value: string; label: string }
export type AuditPageLog = {
  id: number
  adminUsername: string
  operationType: string
  targetLabel?: string | null
  reason?: string | null
  detailJson?: string | null
  createdAt: string
}

export type AuditPageProps = {
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  filters: AuditQueryState
  onFiltersChange: (patch: Partial<AuditQueryState>) => void
  projectOptions: AuditPageProjectOption[]
  operationTypeOptions: AuditPageOperationTypeOption[]
  getOperationTypeLabel: (operationType: string) => string
  logs: AuditPageLog[]
  pagination: {
    currentPage: number
    totalPages: number
    totalItems: number
    startIndex: number
    endIndex: number
  }
  onPageChange: (page: number) => void
  onExport: () => void
  onOpenDetail: (log: AuditPageLog) => void
}

const fieldClassName =
  'h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/**
 * 审计中心任务页：筛选 → 结果表（不含 detail JSON）→ 行点击时间线 Drawer。
 */
export function AuditPage({
  loading = false,
  error = null,
  onRetry,
  filters,
  onFiltersChange,
  projectOptions,
  operationTypeOptions,
  getOperationTypeLabel,
  logs,
  pagination,
  onPageChange,
  onExport,
  onOpenDetail,
}: AuditPageProps) {
  const { t } = useI18n()

  const paginationSummary = t('auditPage.paginationSummary', '第 {page} / {totalPages} 页 · 共 {total} 条')
    .replace('{page}', String(pagination.currentPage))
    .replace('{totalPages}', String(pagination.totalPages))
    .replace('{total}', String(pagination.totalItems))

  return (
    <>
      <PageHeader
        title={t('auditPage.title', '审计中心')}
        description={t('auditPage.description', '追踪管理员操作，行点击查看完整时间线。')}
      />

      {error ? <ErrorState message={error} retry={onRetry} className="mb-4" /> : null}

      <PageToolbar
        className="mb-3"
        filters={
          <>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                type="text"
                aria-label={t('auditPage.searchLabel', '搜索管理员 / 目标 / 原因')}
                value={filters.keyword}
                onChange={(event) => onFiltersChange({ keyword: event.target.value })}
                placeholder={t('auditPage.searchPlaceholder', '管理员 / 目标 / 原因')}
                className={`${fieldClassName} w-60 pl-9`}
              />
            </div>
            <select
              aria-label={t('auditPage.projectFilterLabel', '项目筛选')}
              value={filters.projectKey}
              onChange={(event) => onFiltersChange({ projectKey: event.target.value })}
              className={fieldClassName}
            >
              <option value="all">{t('auditPage.projectAll', '全部项目')}</option>
              {projectOptions.map((project) => (
                <option key={project.id} value={project.projectKey}>
                  {project.name}
                </option>
              ))}
            </select>
            <select
              aria-label={t('auditPage.operationTypeFilterLabel', '操作类型筛选')}
              value={filters.operationType}
              onChange={(event) => onFiltersChange({ operationType: event.target.value })}
              className={fieldClassName}
            >
              <option value="all">{t('auditPage.operationTypeAll', '全部操作')}</option>
              {operationTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </>
        }
        actions={
          <>
            <button
              type="button"
              onClick={onRetry}
              aria-label={t('auditPage.refresh', '刷新')}
              title={t('auditPage.refresh', '刷新')}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-input bg-background text-foreground shadow-sm transition hover:bg-accent"
            >
              <RefreshCw className={`h-4 w-4${loading ? ' animate-spin' : ''}`} aria-hidden />
            </button>
            <button
              type="button"
              onClick={onExport}
              disabled={pagination.totalItems === 0}
              className="inline-flex h-10 items-center rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('auditPage.export', '导出筛选结果')}
            </button>
          </>
        }
      />

      <details className="mb-3 rounded-lg border bg-card shadow-sm">
        <summary className="flex h-11 cursor-pointer items-center gap-1.5 px-4 text-sm font-medium text-foreground select-none">
          <ChevronDown className="h-4 w-4 transition-transform [[open]>&]:rotate-180" aria-hidden />
          {t('auditPage.timeRange', '时间范围')}
          {filters.createdFrom || filters.createdTo ? (
            <span className="text-xs font-normal text-muted-foreground">
              {filters.createdFrom || '—'} ~ {filters.createdTo || '—'}
            </span>
          ) : null}
        </summary>
        <div className="grid gap-3 border-t px-4 py-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="audit-created-from" className="text-xs font-medium text-foreground">
              {t('auditPage.fromLabel', '开始时间')}
            </label>
            <input
              id="audit-created-from"
              type="datetime-local"
              value={filters.createdFrom}
              onChange={(event) => onFiltersChange({ createdFrom: event.target.value })}
              className={`${fieldClassName} w-full`}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="audit-created-to" className="text-xs font-medium text-foreground">
              {t('auditPage.toLabel', '结束时间')}
            </label>
            <input
              id="audit-created-to"
              type="datetime-local"
              value={filters.createdTo}
              onChange={(event) => onFiltersChange({ createdTo: event.target.value })}
              className={`${fieldClassName} w-full`}
            />
          </div>
        </div>
      </details>

      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-4 py-3 font-medium">{t('auditPage.columnTime', '时间')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('auditPage.columnOperation', '操作类型')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('auditPage.columnAdmin', '管理员')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('auditPage.columnTarget', '目标')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('auditPage.columnReason', '原因')}</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  <span className="sr-only">{t('auditPage.columnActions', '操作')}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading && logs.length === 0
                ? Array.from({ length: 3 }).map((_, index) => (
                    <tr key={index}>
                      <td colSpan={6} className="px-4 py-3">
                        <Skeleton className="h-8 w-full" />
                      </td>
                    </tr>
                  ))
                : logs.map((log) => (
                    <tr key={log.id} className="transition hover:bg-muted/30">
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <button
                          type="button"
                          onClick={() => onOpenDetail(log)}
                          className="font-medium text-foreground hover:underline"
                        >
                          {getOperationTypeLabel(log.operationType)}
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{log.adminUsername}</td>
                      <td className="max-w-[180px] truncate whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">
                        {log.targetLabel || '—'}
                      </td>
                      <td className="max-w-[220px] truncate px-4 py-3 text-muted-foreground">
                        {log.reason || '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => onOpenDetail(log)}
                          className="text-sm text-muted-foreground transition hover:text-foreground"
                        >
                          {t('auditPage.detail', '详情')}
                        </button>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {!loading && logs.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title={
                filters.keyword || filters.projectKey !== 'all' || filters.operationType !== 'all' || filters.createdFrom || filters.createdTo
                  ? t('auditPage.emptyFiltered', '没有匹配的操作记录')
                  : t('auditPage.empty', '暂无操作记录')
              }
              description={
                filters.keyword || filters.projectKey !== 'all' || filters.operationType !== 'all' || filters.createdFrom || filters.createdTo
                  ? t('auditPage.emptyFilteredDesc', '调整筛选条件或时间范围后重试。')
                  : t('auditPage.emptyDesc', '管理员的发码、改配置等操作会记录在这里。')
              }
            />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-sm text-muted-foreground">
          <span className="tabular-nums">{paginationSummary}</span>
          {pagination.totalPages > 1 ? (
            <span className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onPageChange(pagination.currentPage - 1)}
                disabled={pagination.currentPage <= 1}
                className="inline-flex h-10 items-center rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('auditPage.prevPage', '上一页')}
              </button>
              <button
                type="button"
                onClick={() => onPageChange(pagination.currentPage + 1)}
                disabled={pagination.currentPage >= pagination.totalPages}
                className="inline-flex h-10 items-center rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('auditPage.nextPage', '下一页')}
              </button>
            </span>
          ) : null}
        </div>
      </div>
    </>
  )
}
