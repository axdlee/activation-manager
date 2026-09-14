'use client'

import * as React from 'react'
import { ChevronDown, RefreshCw, Search } from 'lucide-react'

import { PageHeader } from '@/components/admin/page-header'
import { PageToolbar } from '@/components/admin/page-toolbar'
import { EmptyState } from '@/components/admin/empty-state'
import { ErrorState } from '@/components/admin/error-state'
import { Skeleton } from '@/components/ui-admin/skeleton'
import { Switch } from '@/components/ui-admin/switch'
import type { ConsumptionsQueryState } from '@/lib/admin-logs-query'
import type { LicenseConsumptionLog } from '@/lib/use-consumption-logs'
import { useI18n } from '@/lib/i18n/i18n-provider'

export type ConsumptionsPageProjectOption = { id: number; name: string; projectKey: string }

export type ConsumptionsPageProps = {
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  filters: ConsumptionsQueryState
  onFiltersChange: (patch: Partial<ConsumptionsQueryState>) => void
  projectOptions: ConsumptionsPageProjectOption[]
  autoRefresh: boolean
  onAutoRefreshChange: (value: boolean) => void
  refreshStatusText?: string
  logs: LicenseConsumptionLog[]
  pagination: {
    currentPage: number
    totalPages: number
    totalItems: number
    startIndex: number
    endIndex: number
  }
  onPageChange: (page: number) => void
  onExport: () => void
  onOpenDetail: (log: LicenseConsumptionLog) => void
}

const fieldClassName =
  'h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

const QUICK_RANGES: Array<{ key: 'today' | 'last7Days' | 'last30Days'; label: string }> = [
  { key: 'today', label: '今天' },
  { key: 'last7Days', label: '最近7天' },
  { key: 'last30Days', label: '最近30天' },
]

/**
 * 消费日志任务页：筛选（基础 + 可折叠时间范围）→ 结果表 → 行详情 Drawer。
 * 自动刷新为工具栏开关；导出/分页随 URL query 可分享。
 */
export function ConsumptionsPage({
  loading = false,
  error = null,
  onRetry,
  filters,
  onFiltersChange,
  projectOptions,
  autoRefresh,
  onAutoRefreshChange,
  refreshStatusText,
  logs,
  pagination,
  onPageChange,
  onExport,
  onOpenDetail,
}: ConsumptionsPageProps) {
  const { t } = useI18n()

  const paginationSummary = t('consumptionPage.paginationSummary', '第 {page} / {totalPages} 页 · 共 {total} 条')
    .replace('{page}', String(pagination.currentPage))
    .replace('{totalPages}', String(pagination.totalPages))
    .replace('{total}', String(pagination.totalItems))

  return (
    <>
      <PageHeader
        title={t('consumptionPage.title', '消费日志')}
        description={t('consumptionPage.description', '以排障为中心：筛选请求、定位设备与激活码消耗。')}
        actions={
          refreshStatusText ? (
            <span className="hidden text-xs text-muted-foreground sm:inline">{refreshStatusText}</span>
          ) : undefined
        }
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
                aria-label={t('consumptionPage.searchLabel', '搜索 requestId / 机器ID / 激活码')}
                value={filters.keyword}
                onChange={(event) => onFiltersChange({ keyword: event.target.value })}
                placeholder={t('consumptionPage.searchPlaceholder', 'requestId / machineId / 激活码')}
                className={`${fieldClassName} w-64 pl-9`}
              />
            </div>
            <select
              aria-label={t('consumptionPage.projectFilterLabel', '项目筛选')}
              value={filters.projectKey}
              onChange={(event) => onFiltersChange({ projectKey: event.target.value })}
              className={fieldClassName}
            >
              <option value="all">{t('consumptionPage.projectAll', '全部项目')}</option>
              {projectOptions.map((project) => (
                <option key={project.id} value={project.projectKey}>
                  {project.name}
                </option>
              ))}
            </select>
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm">
              <Switch
                checked={autoRefresh}
                onCheckedChange={onAutoRefreshChange}
                aria-label={t('consumptionPage.autoRefresh', '自动刷新')}
              />
              {t('consumptionPage.autoRefresh', '自动刷新')}
            </label>
          </>
        }
        actions={
          <>
            <button
              type="button"
              onClick={onRetry}
              aria-label={t('consumptionPage.refresh', '刷新')}
              title={t('consumptionPage.refresh', '刷新')}
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
              {t('consumptionPage.export', '导出筛选结果')}
            </button>
          </>
        }
      />

      <details className="mb-3 rounded-lg border bg-card shadow-sm">
        <summary className="flex h-11 cursor-pointer items-center gap-1.5 px-4 text-sm font-medium text-foreground select-none">
          <ChevronDown className="h-4 w-4 transition-transform [[open]>&]:rotate-180" aria-hidden />
          {t('consumptionPage.timeRange', '时间范围')}
          {filters.createdFrom || filters.createdTo ? (
            <span className="text-xs font-normal text-muted-foreground">
              {filters.createdFrom || '—'} ~ {filters.createdTo || '—'}
            </span>
          ) : null}
        </summary>
        <div className="space-y-3 border-t px-4 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="consumption-created-from" className="text-xs font-medium text-foreground">
                {t('consumptionPage.fromLabel', '开始时间')}
              </label>
              <input
                id="consumption-created-from"
                type="datetime-local"
                value={filters.createdFrom}
                onChange={(event) => onFiltersChange({ createdFrom: event.target.value })}
                className={`${fieldClassName} w-full`}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="consumption-created-to" className="text-xs font-medium text-foreground">
                {t('consumptionPage.toLabel', '结束时间')}
              </label>
              <input
                id="consumption-created-to"
                type="datetime-local"
                value={filters.createdTo}
                onChange={(event) => onFiltersChange({ createdTo: event.target.value })}
                className={`${fieldClassName} w-full`}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {QUICK_RANGES.map((range) => (
              <button
                key={range.key}
                type="button"
                data-range={range.key}
                onClick={() => {
                  const now = new Date()
                  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
                  const days = range.key === 'today' ? 0 : range.key === 'last7Days' ? 6 : 29
                  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, 0, 0, 0)
                  const pad = (value: number) => String(value).padStart(2, '0')
                  const fmt = (date: Date) =>
                    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
                  onFiltersChange({ createdFrom: fmt(start), createdTo: fmt(end) })
                }}
                className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground shadow-sm transition hover:bg-accent"
              >
                {range.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onFiltersChange({ createdFrom: '', createdTo: '' })}
              className="inline-flex h-9 items-center rounded-md px-2 text-xs text-muted-foreground transition hover:text-foreground"
            >
              {t('consumptionPage.clearRange', '清空时间')}
            </button>
          </div>
        </div>
      </details>

      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-4 py-3 font-medium">{t('consumptionPage.columnTime', '时间')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('consumptionPage.columnProject', '项目')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('consumptionPage.columnCode', '激活码')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('consumptionPage.columnMachine', '设备 / machineId')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('consumptionPage.columnRemaining', '剩余次数')}</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  <span className="sr-only">{t('consumptionPage.columnActions', '操作')}</span>
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
                      <td className="max-w-[140px] truncate whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {log.activationCode.project?.name || '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <button
                          type="button"
                          onClick={() => onOpenDetail(log)}
                          className="font-mono text-foreground hover:underline"
                          title={t('consumptionPage.openDetail', '查看详情')}
                        >
                          {log.activationCode.code}
                        </button>
                      </td>
                      <td className="max-w-[200px] truncate whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">
                        {log.machineId}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted-foreground">
                        {log.remainingCountAfter} / {log.activationCode.totalCount ?? '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => onOpenDetail(log)}
                          className="text-sm text-muted-foreground transition hover:text-foreground"
                        >
                          {t('consumptionPage.detail', '详情')}
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
                filters.keyword || filters.projectKey !== 'all' || filters.createdFrom || filters.createdTo
                  ? t('consumptionPage.emptyFiltered', '没有匹配的消费日志')
                  : t('consumptionPage.empty', '暂无消费日志')
              }
              description={
                filters.keyword || filters.projectKey !== 'all' || filters.createdFrom || filters.createdTo
                  ? t('consumptionPage.emptyFilteredDesc', '调整筛选条件或时间范围后重试。')
                  : t('consumptionPage.emptyDesc', '激活码被使用后会在这里记录消耗明细。')
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
                {t('consumptionPage.prevPage', '上一页')}
              </button>
              <button
                type="button"
                onClick={() => onPageChange(pagination.currentPage + 1)}
                disabled={pagination.currentPage >= pagination.totalPages}
                className="inline-flex h-10 items-center rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('consumptionPage.nextPage', '下一页')}
              </button>
            </span>
          ) : null}
        </div>
      </div>
    </>
  )
}
