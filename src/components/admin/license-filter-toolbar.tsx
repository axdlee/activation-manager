'use client'

import * as React from 'react'
import { Download, Search } from 'lucide-react'

import { PageToolbar } from '@/components/admin/page-toolbar'
import type { AdminLicensesFilterState } from '@/lib/admin-licenses-query'
import { useI18n } from '@/lib/i18n/i18n-provider'

export type LicenseFilterToolbarProjectOption = {
  id: number
  name: string
  projectKey: string
}

export type LicenseFilterToolbarProps = {
  filters: AdminLicensesFilterState
  onFiltersChange: (patch: Partial<AdminLicensesFilterState>) => void
  projectOptions: LicenseFilterToolbarProjectOption[]
  availableCardTypes: string[]
  onExport?: () => void
  exportDisabled?: boolean
  /** 清理过期绑定（危险操作，容器内经 ConfirmDialog 确认） */
  onCleanup?: () => void
  cleanupDisabled?: boolean
  className?: string
}

const toolbarFieldClassName =
  'h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/**
 * 激活码管理页筛选工具栏：搜索/状态/项目/套餐在左，导出在右，单行排布。
 * 替代旧工作区的整屏「筛选器」子页。
 */
export function LicenseFilterToolbar({
  filters,
  onFiltersChange,
  projectOptions,
  availableCardTypes,
  onExport,
  exportDisabled = false,
  onCleanup,
  cleanupDisabled = false,
  className,
}: LicenseFilterToolbarProps) {
  const { t } = useI18n()

  return (
    <PageToolbar
      className={className}
      filters={
        <>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              type="text"
              aria-label={t('licenseMgmt.searchLabel', '搜索激活码或机器ID')}
              value={filters.keyword}
              onChange={(event) => onFiltersChange({ keyword: event.target.value })}
              placeholder={t('licenseMgmt.searchPlaceholder', '激活码 / machineId')}
              className={`${toolbarFieldClassName} w-56 pl-9`}
            />
          </div>
          <select
            aria-label={t('licenseMgmt.statusFilterLabel', '状态筛选')}
            value={filters.status}
            onChange={(event) =>
              onFiltersChange({ status: event.target.value as AdminLicensesFilterState['status'] })
            }
            className={toolbarFieldClassName}
          >
            <option value="all">{t('licenseMgmt.statusAll', '全部状态')}</option>
            <option value="unused">{t('licenseMgmt.statusUnused', '未激活')}</option>
            <option value="used">{t('licenseMgmt.statusUsed', '使用中 / 已使用')}</option>
            <option value="expired">{t('licenseMgmt.statusExpired', '已过期')}</option>
            <option value="depleted">{t('licenseMgmt.statusDepleted', '已耗尽')}</option>
          </select>
          <select
            aria-label={t('licenseMgmt.projectFilterLabel', '项目筛选')}
            value={filters.projectKey}
            onChange={(event) => onFiltersChange({ projectKey: event.target.value })}
            className={toolbarFieldClassName}
          >
            <option value="all">{t('licenseMgmt.projectAll', '全部项目')}</option>
            {projectOptions.map((project) => (
              <option key={project.id} value={project.projectKey}>
                {project.name}
              </option>
            ))}
          </select>
          <select
            aria-label={t('licenseMgmt.cardTypeFilterLabel', '套餐类型筛选')}
            value={filters.cardType}
            onChange={(event) => onFiltersChange({ cardType: event.target.value })}
            className={toolbarFieldClassName}
          >
            <option value="all">{t('licenseMgmt.cardTypeAll', '全部套餐')}</option>
            {availableCardTypes.map((cardType) => (
              <option key={cardType} value={cardType}>
                {cardType}
              </option>
            ))}
            <option value="none">{t('licenseMgmt.cardTypeNone', '无套餐类型')}</option>
          </select>
        </>
      }
      actions={
        <>
          {onExport ? (
            <button
              type="button"
              onClick={onExport}
              disabled={exportDisabled}
              className="inline-flex h-10 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" aria-hidden />
              {t('licenseMgmt.exportFiltered', '导出筛选结果')}
            </button>
          ) : null}
          {onCleanup ? (
            <button
              type="button"
              onClick={onCleanup}
              disabled={cleanupDisabled}
              className="inline-flex h-10 items-center rounded-md border border-destructive/40 bg-background px-3 text-sm font-medium text-destructive shadow-sm transition hover:bg-destructive/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('licenseMgmt.cleanupExpired', '清理过期绑定')}
            </button>
          ) : null}
        </>
      }
    />
  )
}
