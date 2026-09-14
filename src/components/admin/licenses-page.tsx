'use client'

import * as React from 'react'
import { MoreHorizontal, Plus, RefreshCw } from 'lucide-react'
import Link from 'next/link'

import { PageHeader } from '@/components/admin/page-header'
import {
  LicenseFilterToolbar,
} from '@/components/admin/license-filter-toolbar'
import { EmptyState } from '@/components/admin/empty-state'
import { ErrorState } from '@/components/admin/error-state'
import { Skeleton } from '@/components/ui-admin/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui-admin/dropdown-menu'
import type { AdminLicensesFilterState } from '@/lib/admin-licenses-query'
import type { LicenseModeValue, LicenseStatusLike } from '@/lib/license-status'
import { getCodeStatusLabel } from '@/lib/license-status'
import { useI18n } from '@/lib/i18n/i18n-provider'

/** 列表行所需的激活码字段（完整 ActivationCode 兼容此类型）。 */
export type LicenseCodeListItem = LicenseStatusLike & {
  id: number
  code: string
  licenseMode: LicenseModeValue
  createdAt: string
  usedAt?: string | null
  usedBy?: string | null
  project?: { id: number; name: string; projectKey: string } | null
}

export type LicensesPageProps = {
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  filters: AdminLicensesFilterState
  onFiltersChange: (patch: Partial<AdminLicensesFilterState>) => void
  projectOptions: Array<{ id: number; name: string; projectKey: string }>
  availableCardTypes: string[]
  statusSummary: { unused: number; inUse: number; risk: number }
  codes: LicenseCodeListItem[]
  pagination: {
    currentPage: number
    totalPages: number
    totalItems: number
    startIndex: number
    endIndex: number
  }
  onPageChange: (page: number) => void
  onCopyCode: (code: string) => void
  onDeleteRequest: (code: LicenseCodeListItem) => void
  onOpenDetail: (code: LicenseCodeListItem) => void
  onExport: () => void
  onCleanupRequest: () => void
}

function getStatusTone(code: LicenseCodeListItem): 'default' | 'success' | 'warning' | 'destructive' | 'secondary' {
  const status = getCodeStatusLabel(code)
  if (status === '未激活') return 'secondary'
  if (status === '已激活' || status === '有效') return 'success'
  if (status === '已过期') return 'destructive'
  if (status === '已耗尽') return 'warning'
  return 'default'
}

const badgeToneClass: Record<string, string> = {
  secondary: 'bg-muted text-muted-foreground',
  success: 'bg-emerald-500/10 text-emerald-600',
  destructive: 'bg-destructive/10 text-destructive',
  warning: 'bg-amber-500/10 text-amber-600',
  default: 'bg-muted text-muted-foreground',
}

/**
 * 激活码管理任务页：筛选工具栏 + 结果表 + 行详情 Drawer。
 * 危险操作（删除/清理过期绑定）经 ConfirmDialog 二次确认。
 */
export function LicensesPage({
  loading = false,
  error = null,
  onRetry,
  filters,
  onFiltersChange,
  projectOptions,
  availableCardTypes,
  statusSummary,
  codes,
  pagination,
  onPageChange,
  onCopyCode,
  onDeleteRequest,
  onOpenDetail,
  onExport,
  onCleanupRequest,
}: LicensesPageProps) {
  const { t } = useI18n()

  const paginationSummary = t('licenseMgmt.paginationSummary', '第 {page} / {totalPages} 页 · 共 {total} 条')
    .replace('{page}', String(pagination.currentPage))
    .replace('{totalPages}', String(pagination.totalPages))
    .replace('{total}', String(pagination.totalItems))

  return (
    <>
      <PageHeader
        title={t('licenseMgmt.title', '激活码')}
        description={t('licenseMgmt.description', '排查单码状态、维护换绑策略与绑定关系。')}
        actions={
          <>
            <span className="hidden text-sm text-muted-foreground lg:inline">
              {t('licenseMgmt.summaryBadge', '未激活 {unused} · 使用中 {inUse} · 风险 {risk}')
                .replace('{unused}', String(statusSummary.unused))
                .replace('{inUse}', String(statusSummary.inUse))
                .replace('{risk}', String(statusSummary.risk))}
            </span>
            <Link
              href="/admin/licenses/generate"
              className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" aria-hidden />
              {t('licenseMgmt.generate', '生成激活码')}
            </Link>
          </>
        }
      />

      {error ? <ErrorState message={error} retry={onRetry} className="mb-4" /> : null}

      <LicenseFilterToolbar
        className="mb-3"
        filters={filters}
        onFiltersChange={onFiltersChange}
        projectOptions={projectOptions}
        availableCardTypes={availableCardTypes}
        onExport={onExport}
        exportDisabled={pagination.totalItems === 0}
        onCleanup={onCleanupRequest}
        cleanupDisabled={loading}
      />

      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {t('licenseMgmt.activeFilters', '当前展示符合筛选条件的记录')}
        </span>
        <button
          type="button"
          onClick={onRetry}
          aria-label={t('licenseMgmt.refresh', '刷新列表')}
          title={t('licenseMgmt.refresh', '刷新列表')}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-input bg-background text-foreground shadow-sm transition hover:bg-accent"
        >
          <RefreshCw className={`h-4 w-4${loading ? ' animate-spin' : ''}`} aria-hidden />
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-4 py-3 font-medium">{t('licenseMgmt.columnCode', '激活码')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('licenseMgmt.columnProject', '项目')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('licenseMgmt.columnStatus', '状态')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('licenseMgmt.columnMode', '授权类型')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('licenseMgmt.columnCreatedAt', '创建时间')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('licenseMgmt.columnDevice', '绑定设备')}</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  <span className="sr-only">{t('licenseMgmt.columnActions', '操作')}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading && codes.length === 0
                ? Array.from({ length: 3 }).map((_, index) => (
                    <tr key={index}>
                      <td colSpan={7} className="px-4 py-3">
                        <Skeleton className="h-8 w-full" />
                      </td>
                    </tr>
                  ))
                : codes.map((code) => {
                    const tone = getStatusTone(code)
                    return (
                      <tr key={code.id} className="transition hover:bg-muted/30">
                        <td className="whitespace-nowrap px-4 py-3">
                          <button
                            type="button"
                            onClick={() => onOpenDetail(code)}
                            className="font-mono text-foreground hover:underline"
                            title={t('licenseMgmt.openDetail', '查看详情')}
                          >
                            {code.code}
                          </button>
                        </td>
                        <td className="max-w-[160px] truncate whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {code.project?.name || '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeToneClass[tone]}`}
                          >
                            {getCodeStatusLabel(code)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {code.licenseMode === 'TIME'
                            ? t('licenseMgmt.modeTime', '时间型')
                            : t('licenseMgmt.modeCount', '次数型')}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted-foreground">
                          {new Date(code.createdAt).toLocaleDateString()}
                        </td>
                        <td className="max-w-[180px] truncate whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">
                          {code.usedBy || '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right" onClick={(event) => event.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                aria-label={t('licenseMgmt.moreActions', '更多操作')}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
                              >
                                <MoreHorizontal className="h-4 w-4" aria-hidden />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onSelect={() => onOpenDetail(code)}>
                                {t('licenseMgmt.openDetail', '详情与策略')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => onCopyCode(code.code)}>
                                {t('licenseMgmt.copyCode', '复制激活码')}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onSelect={() => onDeleteRequest(code)}
                              >
                                {t('licenseMgmt.deleteCode', '删除')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    )
                  })}
            </tbody>
          </table>
        </div>

        {!loading && codes.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title={
                filters.keyword || filters.status !== 'all' || filters.projectKey !== 'all' || filters.cardType !== 'all'
                  ? t('licenseMgmt.emptyFiltered', '没有匹配的激活码')
                  : t('licenseMgmt.empty', '还没有激活码')
              }
              description={
                filters.keyword || filters.status !== 'all' || filters.projectKey !== 'all' || filters.cardType !== 'all'
                  ? t('licenseMgmt.emptyFilteredDesc', '调整筛选条件后重试。')
                  : t('licenseMgmt.emptyDesc', '前往生成页创建第一批激活码。')
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
                {t('licenseMgmt.prevPage', '上一页')}
              </button>
              <button
                type="button"
                onClick={() => onPageChange(pagination.currentPage + 1)}
                disabled={pagination.currentPage >= pagination.totalPages}
                className="inline-flex h-10 items-center rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('licenseMgmt.nextPage', '下一页')}
              </button>
            </span>
          ) : null}
        </div>
      </div>
    </>
  )
}
