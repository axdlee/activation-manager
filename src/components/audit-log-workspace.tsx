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
import {
  auditLogWorkspaceTabs,
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
  'rounded-[28px] border border-slate-200/70 bg-white/90 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.28)] backdrop-blur'
const defaultWorkspaceSummaryCardClassName =
  'rounded-[22px] border border-white/80 bg-white/80 px-4 py-4 shadow-sm'
const defaultCompactInputClassName =
  'w-full rounded-2xl border border-slate-200 bg-white/95 px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 disabled:bg-slate-100 disabled:text-slate-500'
const defaultPrimaryButtonClassName =
  'inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/15 transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50'
const defaultSuccessButtonClassName =
  'inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition hover:-translate-y-0.5 hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50'
const defaultGhostButtonClassName =
  'inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 text-sm font-medium text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50'
const defaultPaginationButtonClassName =
  'inline-flex h-10 min-w-[2.5rem] items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'
const defaultPaginationActiveButtonClassName =
  'border-sky-500 bg-sky-500 text-white shadow-lg shadow-sky-500/20 hover:border-sky-500 hover:bg-sky-500'

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
  return (
    <div className="space-y-6">
      <div className={panelClassName}>
        <WorkspaceHeroPanel
          badge="审计日志工作区"
          title="全局审计中心"
          description="把管理员操作统一收敛到可筛选、可导出、可分页的审计工作区，便于回溯项目配置变更、发码动作与人工换绑。"
          gradientClassName="bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(244,114,182,0.1),transparent_30%)]"
          metrics={
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <WorkspaceMetricCard
                label="匹配日志"
                value={matchedCount}
                description="当前条件下的管理员操作数"
                className={workspaceSummaryCardClassName}
              />
              <WorkspaceMetricCard
                label="涉及管理员"
                value={operatorCoverage}
                description="当前结果包含的操作账号数"
                className={workspaceSummaryCardClassName}
              />
              <WorkspaceMetricCard
                label="涉及项目"
                value={projectCoverage}
                description="当前结果覆盖的项目数"
                className={workspaceSummaryCardClassName}
              />
            </div>
          }
          tabs={
            <WorkspaceTabNav
              tabs={auditLogWorkspaceTabs}
              activeTab={activeTab}
              onChange={onTabChange}
            />
          }
        />
      </div>

      {activeTab === 'filters' ? (
        <div className={`${panelClassName} p-6`}>
          <DashboardSectionHeader
            title="筛选与导出"
            description="按管理员、项目、操作类型和时间窗口快速缩小范围，避免在长日志列表里盲翻。"
            trailing={
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={filtersView.onReset}
                  disabled={filtersView.filterTokens.length === 0}
                  className={ghostButtonClassName}
                >
                  重置筛选
                </button>
                <button
                  type="button"
                  onClick={() => onTabChange('logs')}
                  className={primaryButtonClassName}
                >
                  查看日志列表
                </button>
              </div>
            }
          />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-6">
            <DashboardFilterFieldCard
              label="搜索管理员 / 目标 / 原因"
              description="支持按管理员账号、项目标识、激活码目标或原因说明快速回溯。"
              htmlFor="audit-log-search-term"
            >
              <input
                id="audit-log-search-term"
                type="text"
                value={filtersView.searchTerm}
                onChange={(event) => filtersView.onSearchTermChange(event.target.value)}
                className={compactInputClassName}
                placeholder="输入管理员、目标或原因"
              />
            </DashboardFilterFieldCard>

            <DashboardFilterFieldCard
              label="项目筛选"
              description="只观察某个项目时，更容易梳理一条业务线上的配置变更与人工操作。"
              htmlFor="audit-log-project-filter"
            >
              <select
                id="audit-log-project-filter"
                value={filtersView.projectFilter}
                onChange={(event) => filtersView.onProjectFilterChange(event.target.value)}
                className={compactInputClassName}
              >
                <option value="all">全部项目</option>
                {filtersView.projectOptions.map((project) => (
                  <option key={project.id} value={project.projectKey}>
                    {project.name}
                  </option>
                ))}
              </select>
            </DashboardFilterFieldCard>

            <DashboardFilterFieldCard
              label="操作类型"
              description="快速区分发码、项目配置、单码策略和人工换绑相关操作。"
              htmlFor="audit-log-operation-type-filter"
            >
              <select
                id="audit-log-operation-type-filter"
                value={filtersView.operationTypeFilter}
                onChange={(event) => filtersView.onOperationTypeFilterChange(event.target.value)}
                className={compactInputClassName}
              >
                <option value="all">全部操作</option>
                {filtersView.operationTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </DashboardFilterFieldCard>

            <DashboardFilterFieldCard
              label="开始时间"
              description="从这个时间点开始回溯管理动作。"
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
              label="结束时间"
              description="限定排查结束时间，避免导出过多无关日志。"
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
              label="导出当前结果"
              description="按当前筛选条件导出 CSV，适合审计留档与问题复盘。"
            >
              <button
                type="button"
                onClick={filtersView.onExport}
                className={`w-full ${successButtonClassName}`}
              >
                导出筛选结果
              </button>
            </DashboardFilterFieldCard>
          </div>

          <div className="mt-5 rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.94))] p-5 shadow-[0_18px_56px_-42px_rgba(15,23,42,0.22)]">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">当前生效条件</div>
            <DashboardTokenList
              tokens={filtersView.filterTokens}
              emptyText="当前未设置任何筛选条件"
              className="mt-3 flex flex-wrap gap-2"
            />
          </div>
        </div>
      ) : (
        <div className={`${panelClassName} p-6`}>
          <DashboardSectionHeader
            title={`审计日志列表 (${logsView.totalCount} 条记录)`}
            description="统一查看后台管理员的关键操作，便于复盘谁在什么时间对哪个项目或激活码进行了变更。"
            trailing={
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => onTabChange('filters')}
                  className={ghostButtonClassName}
                >
                  查看筛选器
                </button>
                <button
                  type="button"
                  onClick={logsView.onExport}
                  disabled={loading || logsView.totalCount === 0}
                  className={successButtonClassName}
                >
                  导出筛选结果
                </button>
              </div>
            }
            className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"
          />

          <DashboardSummaryStrip
            leading={
              <DashboardTokenList
                tokens={logsView.filterTokens}
                emptyText="当前显示全部管理员审计日志"
              />
            }
            trailing={
              <div className="text-sm text-slate-500">
                当前展示第 {logsView.startIndex} - {logsView.endIndex} 条，共 {logsView.totalCount}{' '}
                条记录
              </div>
            }
          />

          {loading ? (
            <DashboardLoadingState message="加载中..." />
          ) : (
            <>
              <DashboardDataTable
                headers={['操作类型', '管理员', '项目', '激活码', '目标', '原因', '详情', '操作时间']}
                tableClassName="w-full min-w-[1280px] divide-y divide-gray-200"
              >
                {logsView.logs.map((log) => (
                  <tr key={log.id} className="transition hover:bg-slate-50/80">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-700">
                      {log.operationTypeLabel}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {log.adminUsername}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {log.project ? `${log.project.name} (${log.project.projectKey})` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-900">
                      {log.activationCode?.code || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {log.targetLabel || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {log.reason || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {log.detailSummary || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </DashboardDataTable>

              {logsView.logs.length === 0 ? (
                <DashboardEmptyState
                  message="暂无匹配的管理员审计日志，建议切换到“筛选与导出”调整关键词、项目、操作类型或时间范围。"
                  className="mt-5"
                />
              ) : null}

              <DashboardPaginationBar
                currentPage={logsView.currentPage}
                totalPages={logsView.totalPages}
                summary={`显示第 ${logsView.startIndex} - ${logsView.endIndex} 条，共 ${logsView.totalCount} 条记录`}
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
