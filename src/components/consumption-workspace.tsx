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
  consumptionWorkspaceTabs,
  type ConsumptionWorkspaceTab,
} from '@/lib/dashboard-workspace-tabs'
import { type LicenseModeValue } from '@/lib/license-status'

type ConsumptionWorkspaceProjectOption = {
  id: number
  name: string
  projectKey: string
}

type ConsumptionWorkspaceLogLike = {
  id: number
  requestId: string
  machineId: string
  remainingCountAfter: number
  createdAt: string
  activationCode: {
    code: string
    licenseMode: LicenseModeValue
    project: {
      name: string
    }
  }
}

type ConsumptionWorkspaceFiltersView = {
  searchTerm: string
  projectFilter: string
  createdFrom: string
  createdTo: string
  projectOptions: ConsumptionWorkspaceProjectOption[]
  filterTokens: string[]
  refreshStatusText: string
  refreshStatusBadgeClassName: string
  autoRefreshDelayMs: number
  totalCount: number
  onSearchTermChange: (value: string) => void
  onProjectFilterChange: (value: string) => void
  onCreatedFromChange: (value: string) => void
  onCreatedToChange: (value: string) => void
  onRefresh: () => void
  onExport: () => void
  onReset: () => void
  onApplyToday: () => void
  onApplyLast7Days: () => void
  onApplyLast30Days: () => void
  onClearTimeRange: () => void
}

type ConsumptionWorkspaceLogsView<TLog extends ConsumptionWorkspaceLogLike = ConsumptionWorkspaceLogLike> = {
  filterTokens: string[]
  refreshStatusText: string
  refreshStatusBadgeClassName: string
  autoRefreshDelayMs: number
  totalCount: number
  startIndex: number
  endIndex: number
  currentPage: number
  totalPages: number
  logs: TLog[]
  onRefresh: () => void
  onExport: () => void
  onPageChange: (page: number) => void
  getLicenseModeDisplay: (mode: LicenseModeValue) => React.ReactNode
}

type ConsumptionWorkspaceProps<TLog extends ConsumptionWorkspaceLogLike = ConsumptionWorkspaceLogLike> = {
  activeTab: ConsumptionWorkspaceTab
  onTabChange: (tab: ConsumptionWorkspaceTab) => void
  matchedCount: number
  projectCoverage: number
  codeCoverage: number
  loading: boolean
  filtersView: ConsumptionWorkspaceFiltersView
  logsView: ConsumptionWorkspaceLogsView<TLog>
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

export function ConsumptionWorkspace<TLog extends ConsumptionWorkspaceLogLike>({
  activeTab,
  onTabChange,
  matchedCount,
  projectCoverage,
  codeCoverage,
  loading,
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
}: ConsumptionWorkspaceProps<TLog>) {
  return (
    <div className="space-y-6">
      <div className={panelClassName}>
        <WorkspaceHeroPanel
          badge="消费日志工作区"
          title="消费日志排查中心"
          description="把筛选与刷新动作从日志结果页里拆出来，长表格只负责阅读与导出，避免搜索区压缩可视空间。"
          gradientClassName="bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.1),transparent_30%)]"
          metrics={
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <WorkspaceMetricCard
                label="匹配日志"
                value={matchedCount}
                description="当前条件下的消费记录数"
                className={workspaceSummaryCardClassName}
              />
              <WorkspaceMetricCard
                label="涉及项目"
                value={projectCoverage}
                description="当前页涉及的项目数"
                className={workspaceSummaryCardClassName}
              />
              <WorkspaceMetricCard
                label="涉及激活码"
                value={codeCoverage}
                description="当前页覆盖的激活码数"
                className={workspaceSummaryCardClassName}
              />
            </div>
          }
          tabs={
            <WorkspaceTabNav
              tabs={consumptionWorkspaceTabs}
              activeTab={activeTab}
              onChange={onTabChange}
            />
          }
        />
      </div>

      {activeTab === 'filters' ? (
        <div className={`${panelClassName} p-6`}>
          <DashboardSectionHeader
            title="筛选与刷新"
            description="适合排查插件调用链路、幂等请求与真实扣次波动，所有筛选输入都统一到更圆润的卡片表单里。"
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

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
            <DashboardFilterFieldCard
              label="搜索 requestId / 机器ID / 激活码"
              description="适合追踪单次插件调用、设备异常与具体激活码的扣次链路。"
              htmlFor="consumption-search-term"
            >
              <input
                id="consumption-search-term"
                type="text"
                value={filtersView.searchTerm}
                onChange={(event) => filtersView.onSearchTermChange(event.target.value)}
                className={compactInputClassName}
                placeholder="输入 requestId、机器ID 或激活码"
              />
            </DashboardFilterFieldCard>

            <DashboardFilterFieldCard
              label="项目筛选"
              description="只看某一个项目时，更容易判断插件版本发布后的真实扣次波动。"
              htmlFor="consumption-project-filter"
            >
              <select
                id="consumption-project-filter"
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
              label="开始时间"
              description="用于圈定回溯窗口起点，适合配合错误工单或发布日期定位问题。"
              htmlFor="consumption-created-from"
            >
              <input
                id="consumption-created-from"
                type="datetime-local"
                value={filtersView.createdFrom}
                onChange={(event) => filtersView.onCreatedFromChange(event.target.value)}
                className={compactInputClassName}
              />
            </DashboardFilterFieldCard>

            <DashboardFilterFieldCard
              label="结束时间"
              description="与开始时间一起构成完整时间窗，避免长时间段日志对视线造成干扰。"
              htmlFor="consumption-created-to"
            >
              <input
                id="consumption-created-to"
                type="datetime-local"
                value={filtersView.createdTo}
                onChange={(event) => filtersView.onCreatedToChange(event.target.value)}
                className={compactInputClassName}
              />
            </DashboardFilterFieldCard>

            <DashboardFilterFieldCard
              label="刷新当前日志"
              description="立即按当前条件重新拉取，适合观察最新扣次或刚完成的线上操作。"
            >
              <button
                type="button"
                onClick={filtersView.onRefresh}
                disabled={loading}
                className={`w-full ${primaryButtonClassName}`}
              >
                {loading ? '刷新中...' : '刷新消费日志'}
              </button>
            </DashboardFilterFieldCard>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[1.3fr_0.7fr]">
            <div className="rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.94))] p-5 shadow-[0_18px_56px_-42px_rgba(15,23,42,0.22)]">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">快捷时间范围</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={filtersView.onApplyToday} className={ghostButtonClassName}>
                  今天
                </button>
                <button type="button" onClick={filtersView.onApplyLast7Days} className={ghostButtonClassName}>
                  最近7天
                </button>
                <button type="button" onClick={filtersView.onApplyLast30Days} className={ghostButtonClassName}>
                  最近30天
                </button>
                <button type="button" onClick={filtersView.onClearTimeRange} className={ghostButtonClassName}>
                  清空时间
                </button>
              </div>

              <DashboardTokenList
                tokens={filtersView.filterTokens}
                emptyText="当前未设置任何筛选条件"
                className="mt-4 flex flex-wrap gap-2"
              />
            </div>

            <div className="rounded-[24px] border border-slate-200/80 bg-white/92 p-5 shadow-[0_18px_56px_-42px_rgba(15,23,42,0.22)]">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">刷新状态</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm text-sky-700">
                  自动刷新已开启（{filtersView.autoRefreshDelayMs}ms 防抖）
                </span>
                <span
                  className={`rounded-full border px-3 py-1.5 text-sm ${filtersView.refreshStatusBadgeClassName}`}
                >
                  {filtersView.refreshStatusText}
                </span>
              </div>
              <button
                type="button"
                onClick={filtersView.onExport}
                disabled={loading || filtersView.totalCount === 0}
                className={`mt-4 w-full ${successButtonClassName}`}
              >
                导出筛选结果
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className={`${panelClassName} p-6`}>
          <DashboardSectionHeader
            title={`消费日志 (${logsView.totalCount} 条记录)`}
            description="仅记录次数型激活码的真实扣次请求，适合用于对账与问题回溯；筛选器已独立成工作区，阅读时更聚焦。"
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
                  onClick={logsView.onRefresh}
                  disabled={loading}
                  className={primaryButtonClassName}
                >
                  {loading ? '刷新中...' : '刷新消费日志'}
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
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm text-sky-700">
                  自动刷新已开启（{logsView.autoRefreshDelayMs}ms 防抖）
                </span>
                <span
                  className={`rounded-full border px-3 py-1.5 text-sm ${logsView.refreshStatusBadgeClassName}`}
                >
                  {logsView.refreshStatusText}
                </span>
                <DashboardTokenList
                  tokens={logsView.filterTokens}
                  emptyText="当前显示全部消费日志"
                  className="contents"
                  tokenClassName="rounded-full border border-sky-200 bg-white px-3 py-1.5 text-sm text-slate-600"
                />
              </div>
            }
            trailing={
              <div className="text-sm text-slate-500">
                当前展示第 {logsView.startIndex} - {logsView.endIndex} 条，共 {logsView.totalCount}{' '}
                条记录
              </div>
            }
          />

          {loading ? (
            <DashboardLoadingState message={logsView.refreshStatusText} />
          ) : (
            <>
              <DashboardDataTable
                headers={['项目', '激活码', 'requestId', '机器ID', '授权类型', '剩余次数', '消费时间']}
                bodyClassName="bg-white divide-y divide-gray-200"
              >
                {logsView.logs.map((log) => (
                  <tr key={log.id} className="transition hover:bg-slate-50/80">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-700">
                      {log.activationCode.project.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-900">
                      {log.activationCode.code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-500">
                      {log.requestId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {log.machineId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {logsView.getLicenseModeDisplay(log.activationCode.licenseMode)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-700">
                      {log.remainingCountAfter}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </DashboardDataTable>

              {logsView.logs.length === 0 ? (
                <DashboardEmptyState
                  message="暂无匹配的消费日志，建议切换到“筛选与刷新”调整关键词、项目或时间范围。"
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
