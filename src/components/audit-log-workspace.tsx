'use client'

import React from 'react'

import { DashboardDataTable } from '@/components/dashboard-data-table'
import { DashboardEmptyState } from '@/components/dashboard-empty-state'
import { DashboardFilterFieldCard } from '@/components/dashboard-filter-field-card'
import { DashboardLoadingState } from '@/components/dashboard-loading-state'
import { DashboardPaginationBar } from '@/components/dashboard-pagination-bar'
import { DashboardSectionHeader } from '@/components/dashboard-section-header'
import { DashboardSummaryStrip } from '@/components/dashboard-summary-strip'
import { DashboardTokenList } from '@/components/dashboard-token-list'
import { WorkspaceHeroPanel } from '@/components/workspace-hero-panel'
import { WorkspaceMetricCard } from '@/components/workspace-metric-card'
import { WorkspaceTabNav } from '@/components/workspace-tab-nav'
import { useI18n } from '@/lib/i18n/i18n-provider'
import {
  auditLogWorkspaceTabs,
  translateWorkspaceTabs,
  type AuditLogWorkspaceTab,
} from '@/lib/dashboard-workspace-tabs'

type AuditLogWorkspaceProjectOption = {
  id: number
  name: string
  projectKey: string
}

type AuditLogWorkspaceOperationTypeOption = {
  value: string
  label: string
}

type AuditLogWorkspaceLog = {
  id: number
  adminUsername: string
  operationType: string
  operationTypeLabel: string
  targetLabel: string | null
  reason: string | null
  detailSummary: string
  createdAt: string
  project?: {
    id: number
    name: string
    projectKey: string
  } | null
  activationCode?: {
    id: number
    code: string
  } | null
}

type AuditLogWorkspaceFiltersView = {
  searchTerm: string
  projectFilter: string
  operationTypeFilter: string
  createdFrom: string
  createdTo: string
  projectOptions: AuditLogWorkspaceProjectOption[]
  operationTypeOptions: AuditLogWorkspaceOperationTypeOption[]
  filterTokens: string[]
  onSearchTermChange: (value: string) => void
  onProjectFilterChange: (value: string) => void
  onOperationTypeFilterChange: (value: string) => void
  onCreatedFromChange: (value: string) => void
  onCreatedToChange: (value: string) => void
  onReset: () => void
  onExport: () => void
}

type AuditLogWorkspaceLogsView<TLog extends AuditLogWorkspaceLog = AuditLogWorkspaceLog> = {
  filterTokens: string[]
  totalCount: number
  startIndex: number
  endIndex: number
  currentPage: number
  totalPages: number
  logs: TLog[]
  onExport: () => void
  onPageChange: (page: number) => void
}

type AuditLogWorkspaceProps<TLog extends AuditLogWorkspaceLog = AuditLogWorkspaceLog> = {
  activeTab: AuditLogWorkspaceTab
  onTabChange: (tab: AuditLogWorkspaceTab) => void
  loading: boolean
  matchedCount: number
  operatorCoverage: number
  projectCoverage: number
  filtersView: AuditLogWorkspaceFiltersView
  logsView: AuditLogWorkspaceLogsView<TLog>
  panelClassName?: string
  workspaceSummaryCardClassName?: string
  compactInputClassName?: string
  primaryButtonClassName?: string
  successButtonClassName?: string
  ghostButtonClassName?: string
  paginationButtonClassName?: string
  paginationActiveButtonClassName?: string
}

const defaultPanelClassName =
  'rounded-lg border border-surface-200/70 bg-surface-100 shadow-card'
const defaultWorkspaceSummaryCardClassName =
  'rounded-lg border border-surface-200 bg-surface-100 px-4 py-4 shadow-sm'
const defaultCompactInputClassName =
  'w-full rounded-md border border-surface-200 bg-surface-100 px-4 py-2.5 text-sm text-ink-50 shadow-sm outline-none transition placeholder:text-ink-500 focus:border-brand-500/50 focus:ring-4 focus:ring-brand-500/10 disabled:bg-surface-100 disabled:text-ink-500'
const defaultPrimaryButtonClassName =
  'inline-flex items-center justify-center rounded-md bg-ink-900 px-4 py-3 text-sm font-semibold text-white shadow-card transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50'
const defaultSuccessButtonClassName =
  'inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-card transition hover:-translate-y-0.5 hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50'
const defaultGhostButtonClassName =
  'inline-flex items-center justify-center rounded-md border border-surface-200 bg-surface-100 px-4 py-3 text-sm font-medium text-ink-300 shadow-sm transition hover:-translate-y-0.5 hover:border-surface-300 hover:bg-surface-100 disabled:cursor-not-allowed disabled:opacity-50'
const defaultPaginationButtonClassName =
  'inline-flex h-10 min-w-[2.5rem] items-center justify-center rounded-md border border-surface-200 bg-surface-100 px-3 text-sm font-medium text-ink-300 shadow-sm transition hover:-translate-y-0.5 hover:border-surface-300 hover:bg-surface-50 disabled:cursor-not-allowed disabled:opacity-50'
const defaultPaginationActiveButtonClassName =
  'border-sky-500 bg-brand-500 text-white shadow-card hover:border-sky-500 hover:bg-brand-500'

export function AuditLogWorkspace<TLog extends AuditLogWorkspaceLog>({
  activeTab,
  onTabChange,
  loading,
  matchedCount,
  operatorCoverage,
  projectCoverage,
  filtersView,
  logsView,
  panelClassName = defaultPanelClassName,
  workspaceSummaryCardClassName = defaultWorkspaceSummaryCardClassName,
  compactInputClassName = defaultCompactInputClassName,
  primaryButtonClassName = defaultPrimaryButtonClassName,
  successButtonClassName = defaultSuccessButtonClassName,
  ghostButtonClassName = defaultGhostButtonClassName,
  paginationButtonClassName = defaultPaginationButtonClassName,
  paginationActiveButtonClassName = defaultPaginationActiveButtonClassName,
}: AuditLogWorkspaceProps<TLog>) {
  const { t } = useI18n()
  const workspaceTabs = translateWorkspaceTabs(auditLogWorkspaceTabs, t)

  return (
    <div className="space-y-6">
      <div className={panelClassName}>
        <WorkspaceHeroPanel
          badge={t('auditws.badge', '审计日志工作区')}
          title={t('auditws.title', '全局审计中心')}
          description={t(
            'auditws.description',
            '完整记录管理员关键操作，支持筛选、分页与导出，随时回溯变更痕迹。',
          )}
          gradientClassName="bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(244,114,182,0.1),transparent_30%)]"
          metrics={
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <WorkspaceMetricCard
                label={t('auditws.metric.matched', '匹配日志')}
                value={matchedCount}
                description={t('auditws.metric.matchedDesc', '当前条件下的管理员操作数')}
                className={workspaceSummaryCardClassName}
              />
              <WorkspaceMetricCard
                label={t('auditws.metric.operators', '涉及管理员')}
                value={operatorCoverage}
                description={t('auditws.metric.operatorsDesc', '当前结果包含的操作账号数')}
                className={workspaceSummaryCardClassName}
              />
              <WorkspaceMetricCard
                label={t('auditws.metric.projects', '涉及项目')}
                value={projectCoverage}
                description={t('auditws.metric.projectsDesc', '当前结果覆盖的项目数')}
                className={workspaceSummaryCardClassName}
              />
            </div>
          }
          tabs={
            <WorkspaceTabNav
              tabs={workspaceTabs}
              activeTab={activeTab}
              onChange={onTabChange}
            />
          }
        />
      </div>

      {activeTab === 'filters' ? (
        <div className={`${panelClassName} p-6`}>
          <DashboardSectionHeader
            title={t('auditws.filters.title', '筛选与导出')}
            description={t(
              'auditws.filters.description',
              '按管理员、项目、操作类型与时间窗口组合筛选，快速定位目标记录。',
            )}
            trailing={
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={filtersView.onReset}
                  disabled={filtersView.filterTokens.length === 0}
                  className={ghostButtonClassName}
                >
                  {t('auditws.filters.reset', '重置筛选')}
                </button>
                <button
                  type="button"
                  onClick={() => onTabChange('logs')}
                  className={primaryButtonClassName}
                >
                  {t('auditws.filters.viewLogs', '查看日志列表')}
                </button>
              </div>
            }
          />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-6">
            <DashboardFilterFieldCard
              label={t('auditws.filters.searchLabel', '搜索管理员 / 目标 / 原因')}
              description={t(
                'auditws.filters.searchDesc',
                '支持按管理员账号、项目标识、激活码目标或原因说明快速回溯。',
              )}
              htmlFor="audit-log-search-term"
            >
              <input
                id="audit-log-search-term"
                type="text"
                value={filtersView.searchTerm}
                onChange={(event) => filtersView.onSearchTermChange(event.target.value)}
                className={compactInputClassName}
                placeholder={t(
                  'auditws.filters.searchPlaceholder',
                  '输入管理员、目标或原因',
                )}
              />
            </DashboardFilterFieldCard>

            <DashboardFilterFieldCard
              label={t('auditws.filters.projectLabel', '项目筛选')}
              description={t(
                'auditws.filters.projectDesc',
                '只观察某个项目时，更容易梳理一条业务线上的配置变更与人工操作。',
              )}
              htmlFor="audit-log-project-filter"
            >
              <select
                id="audit-log-project-filter"
                value={filtersView.projectFilter}
                onChange={(event) => filtersView.onProjectFilterChange(event.target.value)}
                className={compactInputClassName}
              >
                <option value="all">{t('dash.project.all', '全部项目')}</option>
                {filtersView.projectOptions.map((project) => (
                  <option key={project.id} value={project.projectKey}>
                    {project.name}
                  </option>
                ))}
              </select>
            </DashboardFilterFieldCard>

            <DashboardFilterFieldCard
              label={t('auditws.filters.operationTypeLabel', '操作类型')}
              description={t(
                'auditws.filters.operationTypeDesc',
                '快速区分发码、项目配置、单码策略和人工换绑相关操作。',
              )}
              htmlFor="audit-log-operation-type-filter"
            >
              <select
                id="audit-log-operation-type-filter"
                value={filtersView.operationTypeFilter}
                onChange={(event) => filtersView.onOperationTypeFilterChange(event.target.value)}
                className={compactInputClassName}
              >
                <option value="all">{t('auditws.filters.allOperations', '全部操作')}</option>
                {filtersView.operationTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </DashboardFilterFieldCard>

            <DashboardFilterFieldCard
              label={t('auditws.filters.fromLabel', '开始时间')}
              description={t(
                'auditws.filters.fromDesc',
                '从这个时间点开始回溯管理动作。',
              )}
              htmlFor="audit-log-created-from"
            >
              <input
                id="audit-log-created-from"
                type="datetime-local"
                value={filtersView.createdFrom}
                onChange={(event) => filtersView.onCreatedFromChange(event.target.value)}
                className={compactInputClassName}
              />
            </DashboardFilterFieldCard>

            <DashboardFilterFieldCard
              label={t('auditws.filters.toLabel', '结束时间')}
              description={t(
                'auditws.filters.toDesc',
                '设置查询结束时间，导出结果更聚焦。',
              )}
              htmlFor="audit-log-created-to"
            >
              <input
                id="audit-log-created-to"
                type="datetime-local"
                value={filtersView.createdTo}
                onChange={(event) => filtersView.onCreatedToChange(event.target.value)}
                className={compactInputClassName}
              />
            </DashboardFilterFieldCard>

            <DashboardFilterFieldCard
              label={t('auditws.filters.exportLabel', '导出当前结果')}
              description={t(
                'auditws.filters.exportDesc',
                '按当前筛选条件导出 CSV，适合审计留档与问题复盘。',
              )}
            >
              <button
                type="button"
                onClick={filtersView.onExport}
                className={`w-full ${successButtonClassName}`}
              >
                {t('auditws.filters.export', '导出筛选结果')}
              </button>
            </DashboardFilterFieldCard>
          </div>

          <div className="mt-5 rounded-lg border border-surface-200 bg-surface-100 p-5 shadow-card">
            <div className="text-xs uppercase tracking-[0.18em] text-ink-500">{t('auditws.filters.activeConditions', '当前生效条件')}</div>
            <DashboardTokenList
              tokens={filtersView.filterTokens}
              emptyText={t('auditws.filters.noFilters', '当前未设置任何筛选条件')}
              className="mt-3 flex flex-wrap gap-2"
            />
          </div>
        </div>
      ) : (
        <div className={`${panelClassName} p-6`}>
          <DashboardSectionHeader
            title={t('auditws.logs.title', '审计日志列表 ({count} 条记录)').replace('{count}', String(logsView.totalCount))}
            description={t(
                'auditws.logs.description',
                '清晰还原谁在什么时间对哪个项目或激活码做了什么变更。',
              )}
            trailing={
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => onTabChange('filters')}
                  className={ghostButtonClassName}
                >
                  {t('auditws.logs.viewFilters', '查看筛选器')}
                </button>
                <button
                  type="button"
                  onClick={logsView.onExport}
                  disabled={loading || logsView.totalCount === 0}
                  className={successButtonClassName}
                >
                  {t('auditws.filters.export', '导出筛选结果')}
                </button>
              </div>
            }
            className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"
          />

          <DashboardSummaryStrip
            leading={
              <DashboardTokenList
                tokens={logsView.filterTokens}
                emptyText={t('auditws.logs.allTokens', '当前显示全部管理员审计日志')}
              />
            }
            trailing={
              <div className="text-sm text-ink-500">
                {t('auditws.logs.showingRange', '当前展示第 {start} - {end} 条，共 {total} 条记录')
                  .replace('{start}', String(logsView.startIndex))
                  .replace('{end}', String(logsView.endIndex))
                  .replace('{total}', String(logsView.totalCount))}
              </div>
            }
          />

          {loading ? (
            <DashboardLoadingState message={t('auditws.logs.loading', '加载中...')} />
          ) : (
            <>
              <DashboardDataTable
                headers={[
                  t('auditws.logs.col.operationType', '操作类型'),
                  t('auditws.logs.col.admin', '管理员'),
                  t('auditws.logs.col.project', '项目'),
                  t('auditws.logs.col.code', '激活码'),
                  t('auditws.logs.col.target', '目标'),
                  t('auditws.logs.col.reason', '原因'),
                  t('auditws.logs.col.detail', '详情'),
                  t('auditws.logs.col.operatedAt', '操作时间'),
                ]}
                tableClassName="w-full min-w-[1280px] divide-y divide-surface-200"
              >
                {logsView.logs.map((log) => (
                  <tr key={log.id} className="transition hover:bg-surface-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-ink-200">
                      {log.operationTypeLabel}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-ink-500">
                      {log.adminUsername}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-ink-500">
                      {log.project ? `${log.project.name} (${log.project.projectKey})` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-ink-50">
                      {log.activationCode?.code || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-ink-500">
                      {log.targetLabel || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-ink-500">
                      {log.reason || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-ink-500">
                      {log.detailSummary || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-ink-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </DashboardDataTable>

              {logsView.logs.length === 0 ? (
                <DashboardEmptyState
                  message={t(
                    'auditws.logs.empty',
                    '暂无匹配的管理员审计日志，建议切换到“筛选与导出”调整关键词、项目、操作类型或时间范围。',
                  )}
                  className="mt-5"
                />
              ) : null}

              <DashboardPaginationBar
                currentPage={logsView.currentPage}
                totalPages={logsView.totalPages}
                summary={t('auditws.logs.pageSummary', '显示第 {start} - {end} 条，共 {total} 条记录')
                  .replace('{start}', String(logsView.startIndex))
                  .replace('{end}', String(logsView.endIndex))
                  .replace('{total}', String(logsView.totalCount))}
                onPageChange={logsView.onPageChange}
                buttonClassName={paginationButtonClassName}
                activeButtonClassName={paginationActiveButtonClassName}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}
