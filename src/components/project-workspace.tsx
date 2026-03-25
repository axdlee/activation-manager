'use client'

import React from 'react'

import { DashboardActionPanel } from '@/components/dashboard-action-panel'
import { DashboardDataTable } from '@/components/dashboard-data-table'
import { DashboardEmptyState } from '@/components/dashboard-empty-state'
import { DashboardFilterFieldCard } from '@/components/dashboard-filter-field-card'
import { DashboardPaginationBar } from '@/components/dashboard-pagination-bar'
import { DashboardProjectManagementRow } from '@/components/dashboard-project-management-row'
import { DashboardSectionHeader } from '@/components/dashboard-section-header'
import { WorkspaceHeroPanel } from '@/components/workspace-hero-panel'
import { WorkspaceMetricCard } from '@/components/workspace-metric-card'
import { WorkspaceTabNav } from '@/components/workspace-tab-nav'
import {
  projectWorkspaceTabs,
  type ProjectWorkspaceTab,
} from '@/lib/dashboard-workspace-tabs'
import {
  type ProjectManagementListItem,
  type ProjectManagementSortOption,
  type ProjectManagementStatusFilter,
} from '@/lib/project-management-list'
import {
  PROJECT_KEY_ALLOWED_PATTERN,
  PROJECT_KEY_MAX_LENGTH,
  PROJECT_KEY_MIN_LENGTH,
  PROJECT_KEY_RULE_HINT,
} from '@/lib/project-key'

type ProjectWorkspaceManagePage = {
  items: ProjectManagementListItem[]
  totalItems: number
  totalPages: number
  currentPage: number
  pageSize: number
}

type ProjectWorkspaceCreateForm = {
  name: string
  projectKey: string
  description: string
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onNameChange: (value: string) => void
  onProjectKeyChange: (value: string) => void
  onDescriptionChange: (value: string) => void
}

type ProjectWorkspaceManageView = {
  totalProjects: number
  searchTerm: string
  statusFilter: ProjectManagementStatusFilter
  sortBy: ProjectManagementSortOption
  page: ProjectWorkspaceManagePage
  startIndex: number
  endIndex: number
  getProjectNameDraft: (project: ProjectManagementListItem) => string
  getProjectDescriptionDraft: (project: ProjectManagementListItem) => string
  hasProjectNameChanged: (project: ProjectManagementListItem) => boolean
  hasProjectDescriptionChanged: (project: ProjectManagementListItem) => boolean
  onSearchTermChange: (value: string) => void
  onStatusFilterChange: (value: ProjectManagementStatusFilter) => void
  onSortByChange: (value: ProjectManagementSortOption) => void
  onPageChange: (page: number) => void
  onProjectNameChange: (projectId: number, value: string) => void
  onProjectDescriptionChange: (projectId: number, value: string) => void
  onCopyProjectKey: (projectKey: string) => void
  onSaveProjectName: (project: ProjectManagementListItem) => void
  onSaveProjectDescription: (project: ProjectManagementListItem) => void
  onToggleProjectStatus: (project: ProjectManagementListItem) => void
  onDeleteProject: (project: ProjectManagementListItem) => void
}

type ProjectWorkspaceProps = {
  activeTab: ProjectWorkspaceTab
  onTabChange: (tab: ProjectWorkspaceTab) => void
  enabledProjectsCount: number
  disabledProjectsCount: number
  loading: boolean
  createForm: ProjectWorkspaceCreateForm
  manageView: ProjectWorkspaceManageView
  panelClassName?: string
  workspaceSummaryCardClassName?: string
  compactInputClassName?: string
  primaryButtonClassName?: string
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
const defaultPaginationButtonClassName =
  'inline-flex h-10 min-w-[2.5rem] items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'
const defaultPaginationActiveButtonClassName =
  'border-sky-500 bg-sky-500 text-white shadow-lg shadow-sky-500/20 hover:border-sky-500 hover:bg-sky-500'

export function ProjectWorkspace({
  activeTab,
  onTabChange,
  enabledProjectsCount,
  disabledProjectsCount,
  loading,
  createForm,
  manageView,
  panelClassName = defaultPanelClassName,
  workspaceSummaryCardClassName = defaultWorkspaceSummaryCardClassName,
  compactInputClassName = defaultCompactInputClassName,
  primaryButtonClassName = defaultPrimaryButtonClassName,
  paginationButtonClassName = defaultPaginationButtonClassName,
  paginationActiveButtonClassName = defaultPaginationActiveButtonClassName,
}: ProjectWorkspaceProps) {
  const paginationSummary = `显示第 ${manageView.startIndex} - ${manageView.endIndex} 条，共 ${manageView.page.totalItems} 条记录`

  return (
    <div className="space-y-6">
      <div className={panelClassName}>
        <WorkspaceHeroPanel
          badge="项目工作区"
          title="项目管理中心"
          description="把新建项目和存量项目维护拆开处理，减少长页面滚动，也让搜索与编辑操作更聚焦。"
          gradientClassName="bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.1),transparent_30%)]"
          metrics={
            <div className="grid grid-cols-2 gap-3">
              <WorkspaceMetricCard
                label="启用中"
                value={enabledProjectsCount}
                description="当前可正常发码的项目"
                className={workspaceSummaryCardClassName}
              />
              <WorkspaceMetricCard
                label="已停用"
                value={disabledProjectsCount}
                description="暂不允许继续发码的项目"
                className={workspaceSummaryCardClassName}
              />
            </div>
          }
          tabs={
            <WorkspaceTabNav
              tabs={projectWorkspaceTabs}
              activeTab={activeTab}
              onChange={onTabChange}
              badgeTextClassName="text-sm"
            />
          }
        />
      </div>

      {activeTab === 'create' ? (
        <div className={`${panelClassName} p-6`}>
          <DashboardSectionHeader
            title="新建项目"
            description="为不同产品或插件创建独立 projectKey，后续发码、统计和消费都能按项目隔离。"
            trailing={
              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500">
                创建后会自动出现在发码与筛选器中
              </div>
            }
            className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"
          />

          <form onSubmit={createForm.onSubmit} className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <DashboardFilterFieldCard
              label="项目名称"
              description="面向管理员显示的主标题。"
              htmlFor="create-project-name"
            >
              <input
                id="create-project-name"
                type="text"
                value={createForm.name}
                onChange={(event) => createForm.onNameChange(event.target.value)}
                className={compactInputClassName}
                placeholder="项目名称"
                required
              />
            </DashboardFilterFieldCard>
            <DashboardFilterFieldCard
              label="项目标识"
              description={
                <>
                  {PROJECT_KEY_RULE_HINT} 例如 <span className="font-medium text-slate-700">browser-plugin</span>。
                </>
              }
              htmlFor="create-project-key"
            >
              <input
                id="create-project-key"
                type="text"
                value={createForm.projectKey}
                onChange={(event) => createForm.onProjectKeyChange(event.target.value)}
                className={compactInputClassName}
                placeholder="项目标识，例如 browser-plugin"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                pattern={PROJECT_KEY_ALLOWED_PATTERN.source}
                minLength={PROJECT_KEY_MIN_LENGTH}
                maxLength={PROJECT_KEY_MAX_LENGTH}
                required
              />
            </DashboardFilterFieldCard>
            <DashboardFilterFieldCard
              label="项目描述"
              description="可选，用于补充当前项目的用途说明。"
              htmlFor="create-project-description"
            >
              <input
                id="create-project-description"
                type="text"
                value={createForm.description}
                onChange={(event) => createForm.onDescriptionChange(event.target.value)}
                className={compactInputClassName}
                placeholder="项目描述（可选）"
              />
            </DashboardFilterFieldCard>
            <div className="xl:col-span-3">
              <DashboardActionPanel
                badge="创建后立即可用"
                title="准备创建新的项目空间？"
                description="新项目会立即出现在发码、统计和激活码筛选中，建议先确认 projectKey 命名稳定。"
                action={
                  <button
                    type="submit"
                    disabled={loading}
                    className={`w-full lg:w-auto ${primaryButtonClassName}`}
                  >
                    {loading ? '创建中...' : '创建项目'}
                  </button>
                }
              />
            </div>
          </form>
        </div>
      ) : (
        <div className={`${panelClassName} p-6`}>
          <div className="mb-5 flex flex-col gap-4">
            <DashboardSectionHeader
              title="项目列表"
              description={`当前匹配 ${manageView.page.totalItems} / ${manageView.totalProjects} 个项目，可直接修改名称、描述和启停状态。`}
              trailing={
                <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500">
                  默认项目名称固定，且不可停用
                </div>
              }
              className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"
            />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <DashboardFilterFieldCard
                label="搜索项目"
                description="按项目名称、projectKey 或描述快速定位。"
                htmlFor="project-management-search-term"
              >
                <input
                  id="project-management-search-term"
                  type="text"
                  value={manageView.searchTerm}
                  onChange={(event) => manageView.onSearchTermChange(event.target.value)}
                  className={compactInputClassName}
                  placeholder="项目名称 / projectKey / 描述"
                />
              </DashboardFilterFieldCard>
              <DashboardFilterFieldCard
                label="状态筛选"
                description="聚焦查看启用中或已停用项目。"
                htmlFor="project-management-status-filter"
              >
                <select
                  id="project-management-status-filter"
                  value={manageView.statusFilter}
                  onChange={(event) =>
                    manageView.onStatusFilterChange(event.target.value as ProjectManagementStatusFilter)
                  }
                  className={compactInputClassName}
                >
                  <option value="all">全部状态</option>
                  <option value="enabled">仅启用中</option>
                  <option value="disabled">仅已停用</option>
                </select>
              </DashboardFilterFieldCard>
              <DashboardFilterFieldCard
                label="排序方式"
                description="根据创建时间或项目名称重排列表。"
                htmlFor="project-management-sort-by"
              >
                <select
                  id="project-management-sort-by"
                  value={manageView.sortBy}
                  onChange={(event) =>
                    manageView.onSortByChange(event.target.value as ProjectManagementSortOption)
                  }
                  className={compactInputClassName}
                >
                  <option value="createdAtDesc">按创建时间（最新优先）</option>
                  <option value="createdAtAsc">按创建时间（最早优先）</option>
                  <option value="nameAsc">按项目名称（A-Z）</option>
                  <option value="nameDesc">按项目名称（Z-A）</option>
                </select>
              </DashboardFilterFieldCard>
            </div>
          </div>

          <DashboardDataTable headers={['项目名称', '项目标识', '描述', '状态', '操作']}>
            {manageView.page.items.map((project) => (
              <DashboardProjectManagementRow
                key={project.id}
                project={project}
                nameValue={manageView.getProjectNameDraft(project)}
                descriptionValue={manageView.getProjectDescriptionDraft(project)}
                compactInputClassName={compactInputClassName}
                loading={loading}
                canSaveName={manageView.hasProjectNameChanged(project)}
                canSaveDescription={manageView.hasProjectDescriptionChanged(project)}
                onNameChange={(value) => manageView.onProjectNameChange(project.id, value)}
                onDescriptionChange={(value) =>
                  manageView.onProjectDescriptionChange(project.id, value)
                }
                onCopyProjectKey={() => manageView.onCopyProjectKey(project.projectKey)}
                onSaveName={() => manageView.onSaveProjectName(project)}
                onSaveDescription={() => manageView.onSaveProjectDescription(project)}
                onToggleStatus={() => manageView.onToggleProjectStatus(project)}
                onDelete={() => manageView.onDeleteProject(project)}
              />
            ))}
          </DashboardDataTable>

          {manageView.page.totalPages > 1 ? (
            <DashboardPaginationBar
              currentPage={manageView.page.currentPage}
              totalPages={manageView.page.totalPages}
              summary={paginationSummary}
              onPageChange={manageView.onPageChange}
              buttonClassName={paginationButtonClassName}
              activeButtonClassName={paginationActiveButtonClassName}
            />
          ) : (
            <div className="mt-6 text-sm text-gray-700">{paginationSummary}</div>
          )}

          {manageView.page.totalItems === 0 ? (
            <DashboardEmptyState
              className="mt-4"
              message={manageView.totalProjects === 0 ? '暂无项目数据' : '暂无匹配的项目'}
            />
          ) : null}
        </div>
      )}
    </div>
  )
}
