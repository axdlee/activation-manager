'use client'

import React, { useEffect, useMemo, useState } from 'react'

import { DashboardDataTable } from '@/components/dashboard-data-table'
import { DashboardEmptyState } from '@/components/dashboard-empty-state'
import { DashboardFilterFieldCard } from '@/components/dashboard-filter-field-card'
import { DashboardFormField } from '@/components/dashboard-form-field'
import { DashboardModal } from '@/components/dashboard-modal'
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
  formatAutoRebindMaxCountLabel,
  formatCooldownMinutesLabel,
} from '@/lib/license-rebind-policy'
import {
  getInheritedRebindPlaceholder,
  getInheritedRebindPolicyOptionLabel,
  getInheritedRebindSettingLabel,
  getScopedRebindCooldownLabel,
  getScopedRebindMaxCountLabel,
  getScopedRebindPolicyLabel,
} from '@/lib/rebind-policy-ui'
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
  rebindPolicyValue?: string
  rebindCooldownMinutesValue?: string
  rebindMaxCountValue?: string
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onNameChange: (value: string) => void
  onProjectKeyChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onRebindPolicyChange?: (value: string) => void
  onRebindCooldownMinutesChange?: (value: string) => void
  onRebindMaxCountChange?: (value: string) => void
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
  getProjectRebindPolicyDraft?: (project: ProjectManagementListItem) => string
  getProjectRebindCooldownMinutesDraft?: (project: ProjectManagementListItem) => string
  getProjectRebindMaxCountDraft?: (project: ProjectManagementListItem) => string
  hasProjectNameChanged: (project: ProjectManagementListItem) => boolean
  hasProjectDescriptionChanged: (project: ProjectManagementListItem) => boolean
  hasProjectRebindSettingsChanged?: (project: ProjectManagementListItem) => boolean
  onSearchTermChange: (value: string) => void
  onStatusFilterChange: (value: ProjectManagementStatusFilter) => void
  onSortByChange: (value: ProjectManagementSortOption) => void
  onPageChange: (page: number) => void
  onProjectNameChange: (projectId: number, value: string) => void
  onProjectDescriptionChange: (projectId: number, value: string) => void
  onProjectRebindPolicyChange?: (projectId: number, value: string) => void
  onProjectRebindCooldownMinutesChange?: (projectId: number, value: string) => void
  onProjectRebindMaxCountChange?: (projectId: number, value: string) => void
  onCopyProjectKey: (projectKey: string) => void
  onSaveProjectName: (project: ProjectManagementListItem) => Promise<void> | void
  onSaveProjectDescription: (project: ProjectManagementListItem) => Promise<void> | void
  onSaveProjectRebindSettings?: (project: ProjectManagementListItem) => Promise<void> | void
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
const defaultGhostButtonClassName =
  'inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 text-sm font-medium text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50'
const defaultPaginationButtonClassName =
  'inline-flex h-10 min-w-[2.5rem] items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'
const defaultPaginationActiveButtonClassName =
  'border-sky-500 bg-sky-500 text-white shadow-lg shadow-sky-500/20 hover:border-sky-500 hover:bg-sky-500'
const modalFooterClassName = 'flex flex-col-reverse gap-3 sm:flex-row sm:justify-end'
const subtleModalSectionClassName = 'rounded-[20px] border border-slate-200 bg-slate-50 p-5'
const modalSectionTitleClassName = 'text-base font-semibold text-slate-900'
const modalSectionDescriptionClassName = 'mt-2 text-sm leading-6 text-slate-500'
const modalFormFieldClassName = 'rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm'

function resolveProjectRebindPolicyValue(project: ProjectManagementListItem) {
  if (project.allowAutoRebind === true) {
    return 'enabled'
  }

  if (project.allowAutoRebind === false) {
    return 'disabled'
  }

  return 'inherit'
}

function resolveProjectRebindPolicyLabel(value: string) {
  if (value === 'enabled') {
    return '允许自助换绑'
  }

  if (value === 'disabled') {
    return '禁止自助换绑'
  }

  return getInheritedRebindSettingLabel('project')
}

function resolveProjectRebindCooldownMinutesValue(project: ProjectManagementListItem) {
  return project.autoRebindCooldownMinutes === null || project.autoRebindCooldownMinutes === undefined
    ? ''
    : String(project.autoRebindCooldownMinutes)
}

function resolveProjectRebindMaxCountValue(project: ProjectManagementListItem) {
  return project.autoRebindMaxCount === null || project.autoRebindMaxCount === undefined
    ? ''
    : String(project.autoRebindMaxCount)
}

function parseDraftNumber(value: string) {
  const normalizedValue = value.trim()

  if (!normalizedValue) {
    return null
  }

  const parsedValue = Number(normalizedValue)

  return Number.isFinite(parsedValue) ? parsedValue : null
}

function formatProjectScopedCooldownSummary(value: number | null) {
  if (value === null) {
    return getInheritedRebindSettingLabel('project')
  }

  return formatCooldownMinutesLabel(value)
}

function formatProjectScopedMaxCountSummary(value: number | null) {
  if (value === null) {
    return getInheritedRebindSettingLabel('project')
  }

  return formatAutoRebindMaxCountLabel(value)
}

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
  ghostButtonClassName = defaultGhostButtonClassName,
  paginationButtonClassName = defaultPaginationButtonClassName,
  paginationActiveButtonClassName = defaultPaginationActiveButtonClassName,
}: ProjectWorkspaceProps) {
  const normalizedActiveTab = activeTab === 'create' ? 'manage' : activeTab
  const [editingBasicsProjectId, setEditingBasicsProjectId] = useState<number | null>(null)
  const [editingRebindProjectId, setEditingRebindProjectId] = useState<number | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(activeTab === 'create')
  const [shouldCloseCreateModalAfterSubmit, setShouldCloseCreateModalAfterSubmit] = useState(false)

  const paginationSummary = `显示第 ${manageView.startIndex} - ${manageView.endIndex} 条，共 ${manageView.page.totalItems} 条记录`
  const projectLookup = useMemo(
    () => new Map(manageView.page.items.map((project) => [project.id, project])),
    [manageView.page.items],
  )
  const editingBasicsProject =
    editingBasicsProjectId === null ? null : projectLookup.get(editingBasicsProjectId) || null
  const editingRebindProject =
    editingRebindProjectId === null ? null : projectLookup.get(editingRebindProjectId) || null

  useEffect(() => {
    if (editingBasicsProjectId !== null && !projectLookup.has(editingBasicsProjectId)) {
      setEditingBasicsProjectId(null)
    }
  }, [editingBasicsProjectId, projectLookup])

  useEffect(() => {
    if (editingRebindProjectId !== null && !projectLookup.has(editingRebindProjectId)) {
      setEditingRebindProjectId(null)
    }
  }, [editingRebindProjectId, projectLookup])

  const buildProjectPolicySummary = (project: ProjectManagementListItem) => {
    const policyValue =
      manageView.getProjectRebindPolicyDraft?.(project) ?? resolveProjectRebindPolicyValue(project)
    const cooldownValue =
      manageView.getProjectRebindCooldownMinutesDraft?.(project) ??
      resolveProjectRebindCooldownMinutesValue(project)
    const maxCountValue =
      manageView.getProjectRebindMaxCountDraft?.(project) ?? resolveProjectRebindMaxCountValue(project)

    return [
      `${getScopedRebindPolicyLabel('project')}：${resolveProjectRebindPolicyLabel(policyValue)}`,
      `${getScopedRebindCooldownLabel('project', false)}：${formatProjectScopedCooldownSummary(
        parseDraftNumber(cooldownValue),
      )}`,
      `${getScopedRebindMaxCountLabel('project')}：${formatProjectScopedMaxCountSummary(
        parseDraftNumber(maxCountValue),
      )}`,
    ]
  }

  const basicsDirty =
    editingBasicsProject !== null &&
    (manageView.hasProjectNameChanged(editingBasicsProject) ||
      manageView.hasProjectDescriptionChanged(editingBasicsProject))
  const rebindDirty =
    editingRebindProject !== null &&
    (manageView.hasProjectRebindSettingsChanged?.(editingRebindProject) ?? false)
  const isCreateFormPristine =
    createForm.name === '' &&
    createForm.projectKey === '' &&
    createForm.description === '' &&
    (createForm.rebindPolicyValue || 'inherit') === 'inherit' &&
    (createForm.rebindCooldownMinutesValue || '') === '' &&
    (createForm.rebindMaxCountValue || '') === ''

  useEffect(() => {
    if (activeTab === 'create') {
      setIsCreateModalOpen(true)
    }
  }, [activeTab])

  useEffect(() => {
    if (loading || !shouldCloseCreateModalAfterSubmit) {
      return
    }

    if (isCreateFormPristine) {
      setIsCreateModalOpen(false)
      if (activeTab === 'create') {
        onTabChange('manage')
      }
    }

    setShouldCloseCreateModalAfterSubmit(false)
  }, [activeTab, isCreateFormPristine, loading, onTabChange, shouldCloseCreateModalAfterSubmit])

  const handleOpenCreateModal = () => {
    setIsCreateModalOpen(true)
    if (activeTab === 'create') {
      onTabChange('manage')
    }
  }

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false)
    if (activeTab === 'create') {
      onTabChange('manage')
    }
  }

  const handleSubmitCreateForm = (event: React.FormEvent<HTMLFormElement>) => {
    setShouldCloseCreateModalAfterSubmit(true)
    createForm.onSubmit(event)
  }

  return (
    <div className="space-y-6">
      <div className={panelClassName}>
        <WorkspaceHeroPanel
          badge="项目工作区"
          title="项目管理中心"
          description="列表只展示关键字段，名称、描述与换绑策略统一通过弹框维护，减少长表格里的输入干扰。"
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
            <div className="mt-6 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0 xl:flex-1">
                <WorkspaceTabNav
                  tabs={projectWorkspaceTabs}
                  activeTab={normalizedActiveTab}
                  onChange={onTabChange}
                  badgeTextClassName="text-sm"
                />
              </div>
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className={`w-full xl:w-auto ${primaryButtonClassName}`}
              >
                新建项目
              </button>
            </div>
          }
        />
      </div>

      <div className={`${panelClassName} p-6`}>
        <div className="mb-5 flex flex-col gap-4">
          <DashboardSectionHeader
            title="项目列表"
            description={`当前匹配 ${manageView.page.totalItems} / ${manageView.totalProjects} 个项目。列表只保留关键字段，所有编辑都改为弹框完成。`}
            trailing={
              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500">
                默认项目名称固定，且不可停用
              </div>
            }
            className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"
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
                <option value="enabled">仅启用</option>
                <option value="disabled">仅停用</option>
              </select>
            </DashboardFilterFieldCard>
            <DashboardFilterFieldCard
              label="排序方式"
              description="根据最新创建时间或项目名称切换查看节奏。"
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
                <option value="createdAtDesc">最新创建</option>
                <option value="createdAtAsc">最早创建</option>
                <option value="nameAsc">名称 A-Z</option>
                <option value="nameDesc">名称 Z-A</option>
              </select>
            </DashboardFilterFieldCard>
          </div>
        </div>

        <DashboardDataTable
          headers={['项目名称', '项目标识', '换绑策略', '状态', '操作']}
          tableClassName="w-full min-w-[1180px] divide-y divide-gray-200"
        >
          {manageView.page.items.map((project) => (
            <DashboardProjectManagementRow
              key={project.id}
              project={project}
              policySummary={buildProjectPolicySummary(project)}
              loading={loading}
              onCopyProjectKey={() => manageView.onCopyProjectKey(project.projectKey)}
              onEditBasics={() => setEditingBasicsProjectId(project.id)}
              onEditRebind={() => setEditingRebindProjectId(project.id)}
              onToggleStatus={() => manageView.onToggleProjectStatus(project)}
              onDelete={() => manageView.onDeleteProject(project)}
            />
          ))}
        </DashboardDataTable>

        {manageView.page.totalItems === 0 ? (
          <DashboardEmptyState message="暂无匹配的项目" className="mt-5" />
        ) : null}

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
      </div>

      <DashboardModal
        open={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        title="新建项目"
        description="用弹框快速创建新的 projectKey，并同步设定项目级默认换绑策略；创建完成后会立即出现在发码、统计与筛选器中。"
        size="xl"
        footer={
          <div className={modalFooterClassName}>
            <button type="button" onClick={handleCloseCreateModal} className={ghostButtonClassName}>
              取消
            </button>
            <button type="submit" form="create-project-form" disabled={loading} className={primaryButtonClassName}>
              {loading ? '创建中...' : '创建项目'}
            </button>
          </div>
        }
      >
        <form id="create-project-form" onSubmit={handleSubmitCreateForm} className="space-y-6">
          <section className="space-y-4">
            <div>
              <h3 className={modalSectionTitleClassName}>基础信息</h3>
              <p className={modalSectionDescriptionClassName}>
                先按常规表单方式填写项目名称、projectKey 与说明，避免在弹框内左右跳读。
              </p>
            </div>

            <DashboardFormField
              label="项目名称"
              description="面向管理员显示的主标题。"
              htmlFor="create-project-name"
              className={modalFormFieldClassName}
              bodyClassName="mt-3"
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
            </DashboardFormField>

            <DashboardFormField
              label="项目标识"
              description={
                <>
                  {PROJECT_KEY_RULE_HINT} 例如 <span className="font-medium text-slate-700">browser-plugin</span>。
                </>
              }
              htmlFor="create-project-key"
              className={modalFormFieldClassName}
              bodyClassName="mt-3"
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
            </DashboardFormField>

            <DashboardFormField
              label="项目描述"
              description="可选，用于补充当前项目的用途说明。"
              htmlFor="create-project-description"
              className={modalFormFieldClassName}
              bodyClassName="mt-3"
            >
              <textarea
                id="create-project-description"
                value={createForm.description}
                onChange={(event) => createForm.onDescriptionChange(event.target.value)}
                className={`${compactInputClassName} min-h-[120px] resize-y`}
                placeholder="项目描述（可选）"
              />
            </DashboardFormField>
          </section>

          <section className={`${subtleModalSectionClassName} space-y-4`}>
            <div>
              <h3 className={modalSectionTitleClassName}>策略设置</h3>
              <p className={modalSectionDescriptionClassName}>
                这组设置会作为项目级默认值，被发码和单码配置继续继承或覆盖。
              </p>
            </div>

            <DashboardFormField
              label={getScopedRebindPolicyLabel('project')}
              description="项目级默认规则；若单码级保持继承，会继续回退到这里；项目未配置时再回退系统级。"
              htmlFor="create-project-rebind-policy"
              className={modalFormFieldClassName}
              bodyClassName="mt-3"
            >
              <select
                id="create-project-rebind-policy"
                value={createForm.rebindPolicyValue || 'inherit'}
                onChange={(event) => createForm.onRebindPolicyChange?.(event.target.value)}
                className={compactInputClassName}
              >
                <option value="inherit">{getInheritedRebindPolicyOptionLabel('project')}</option>
                <option value="enabled">允许自助换绑</option>
                <option value="disabled">禁止自助换绑</option>
              </select>
            </DashboardFormField>

            <DashboardFormField
              label={getScopedRebindCooldownLabel('project')}
              description="留空则继承系统级策略；0 表示无冷却。"
              htmlFor="create-project-rebind-cooldown"
              className={modalFormFieldClassName}
              bodyClassName="mt-3"
            >
              <input
                id="create-project-rebind-cooldown"
                type="number"
                min="0"
                value={createForm.rebindCooldownMinutesValue || ''}
                onChange={(event) => createForm.onRebindCooldownMinutesChange?.(event.target.value)}
                className={compactInputClassName}
                placeholder={getInheritedRebindPlaceholder('project', 'cooldown')}
              />
            </DashboardFormField>

            <DashboardFormField
              label={getScopedRebindMaxCountLabel('project')}
              description="0 表示不限制；留空则继承系统级策略。"
              htmlFor="create-project-rebind-max-count"
              className={modalFormFieldClassName}
              bodyClassName="mt-3"
            >
              <input
                id="create-project-rebind-max-count"
                type="number"
                min="0"
                value={createForm.rebindMaxCountValue || ''}
                onChange={(event) => createForm.onRebindMaxCountChange?.(event.target.value)}
                className={compactInputClassName}
                placeholder={getInheritedRebindPlaceholder('project', 'maxCount')}
              />
            </DashboardFormField>
          </section>

          <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-4 text-sm leading-6 text-slate-500">
            创建后会立即出现在项目列表、发码页、统计页和筛选器中；建议先确认 projectKey 命名稳定后再保存。
          </div>
        </form>
      </DashboardModal>

      <DashboardModal
        open={editingBasicsProject !== null}
        onClose={() => setEditingBasicsProjectId(null)}
        title={editingBasicsProject ? `编辑基础信息 · ${editingBasicsProject.name}` : '编辑基础信息'}
        description="项目列表中不再直接输入，基础信息统一在这里维护，避免误改并提升可读性。"
        size="lg"
        footer={
          <div className={modalFooterClassName}>
            <button
              type="button"
              onClick={() => setEditingBasicsProjectId(null)}
              className={ghostButtonClassName}
            >
              关闭
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!editingBasicsProject) {
                  return
                }

                if (manageView.hasProjectNameChanged(editingBasicsProject)) {
                  await manageView.onSaveProjectName(editingBasicsProject)
                }
                if (manageView.hasProjectDescriptionChanged(editingBasicsProject)) {
                  await manageView.onSaveProjectDescription(editingBasicsProject)
                }
              }}
              disabled={!basicsDirty || loading}
              className={primaryButtonClassName}
            >
              保存基础信息
            </button>
          </div>
        }
      >
        {editingBasicsProject ? (
          <div className="space-y-4">
            {editingBasicsProject.projectKey === 'default' ? (
              <div className="rounded-[22px] border border-sky-200/80 bg-sky-50/80 px-5 py-4 text-sm leading-6 text-sky-700">
                默认项目的名称固定，建议仅在这里维护描述说明，方便后台识别其兼容用途。
              </div>
            ) : null}

            <DashboardFormField
              label="项目名称"
              description="用于后台展示与筛选。"
              htmlFor="project-modal-name"
              className={modalFormFieldClassName}
              bodyClassName="mt-3"
            >
              <input
                id="project-modal-name"
                type="text"
                value={manageView.getProjectNameDraft(editingBasicsProject)}
                onChange={(event) =>
                  manageView.onProjectNameChange(editingBasicsProject.id, event.target.value)
                }
                className={compactInputClassName}
                placeholder="项目名称"
                disabled={loading || editingBasicsProject.projectKey === 'default'}
              />
            </DashboardFormField>

            <DashboardFormField
              label="项目标识"
              description="用于 API 接入、项目隔离与激活码归属。"
              htmlFor="project-modal-key"
              className={modalFormFieldClassName}
              bodyClassName="mt-3 space-y-3"
            >
              <input
                id="project-modal-key"
                type="text"
                value={editingBasicsProject.projectKey}
                readOnly
                disabled
                className={compactInputClassName}
              />
              <button
                type="button"
                onClick={() => manageView.onCopyProjectKey(editingBasicsProject.projectKey)}
                className={ghostButtonClassName}
              >
                复制标识
              </button>
            </DashboardFormField>

            <DashboardFormField
              label="项目描述"
              description="补充当前项目对应的产品、插件或客户背景。"
              className={modalFormFieldClassName}
              bodyClassName="mt-3"
            >
              <textarea
                value={manageView.getProjectDescriptionDraft(editingBasicsProject)}
                onChange={(event) =>
                  manageView.onProjectDescriptionChange(editingBasicsProject.id, event.target.value)
                }
                className={`${compactInputClassName} min-h-[140px] resize-y`}
                placeholder="项目描述（可选）"
              />
            </DashboardFormField>
          </div>
        ) : null}
      </DashboardModal>

      <DashboardModal
        open={editingRebindProject !== null}
        onClose={() => setEditingRebindProjectId(null)}
        title={
          editingRebindProject
            ? `编辑项目级换绑策略 · ${editingRebindProject.name}`
            : '编辑项目级换绑策略'
        }
        description="项目级策略会作为单码级与发码默认值的上级来源，适合在这里统一约束自助换绑边界。"
        size="lg"
        footer={
          <div className={modalFooterClassName}>
            <button
              type="button"
              onClick={() => setEditingRebindProjectId(null)}
              className={ghostButtonClassName}
            >
              关闭
            </button>
            <button
              type="button"
              onClick={() =>
                editingRebindProject && manageView.onSaveProjectRebindSettings?.(editingRebindProject)
              }
              disabled={!rebindDirty || loading}
              className={primaryButtonClassName}
            >
              保存项目级换绑策略
            </button>
          </div>
        }
      >
        {editingRebindProject ? (
          <div className="space-y-4">
            <div className={subtleModalSectionClassName}>
              <h3 className={modalSectionTitleClassName}>策略摘要</h3>
              <p className={modalSectionDescriptionClassName}>
                这部分会反映项目层当前正在生效或即将保存的换绑规则。
              </p>
              <div className="mt-4 space-y-3">
                {buildProjectPolicySummary(editingRebindProject).map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-sm leading-6 text-slate-600"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <DashboardFormField
              label={getScopedRebindPolicyLabel('project')}
              description="项目级总开关；单码级保持继承时，会继续沿用这里的规则。"
              htmlFor="project-rebind-policy"
              className={modalFormFieldClassName}
              bodyClassName="mt-3"
            >
              <select
                id="project-rebind-policy"
                value={
                  manageView.getProjectRebindPolicyDraft?.(editingRebindProject) ??
                  resolveProjectRebindPolicyValue(editingRebindProject)
                }
                onChange={(event) =>
                  manageView.onProjectRebindPolicyChange?.(editingRebindProject.id, event.target.value)
                }
                className={compactInputClassName}
              >
                <option value="inherit">{getInheritedRebindPolicyOptionLabel('project')}</option>
                <option value="enabled">允许自助换绑</option>
                <option value="disabled">禁止自助换绑</option>
              </select>
            </DashboardFormField>

            <DashboardFormField
              label={getScopedRebindCooldownLabel('project')}
              description="留空则继承系统级策略；0 表示立即允许再次换绑。"
              htmlFor="project-rebind-cooldown"
              className={modalFormFieldClassName}
              bodyClassName="mt-3"
            >
              <input
                id="project-rebind-cooldown"
                type="number"
                min="0"
                value={
                  manageView.getProjectRebindCooldownMinutesDraft?.(editingRebindProject) ??
                  resolveProjectRebindCooldownMinutesValue(editingRebindProject)
                }
                onChange={(event) =>
                  manageView.onProjectRebindCooldownMinutesChange?.(
                    editingRebindProject.id,
                    event.target.value,
                  )
                }
                className={compactInputClassName}
                placeholder={getInheritedRebindPlaceholder('project', 'cooldown')}
              />
            </DashboardFormField>

            <DashboardFormField
              label={getScopedRebindMaxCountLabel('project')}
              description="0 表示不限制；留空则继承系统级策略。"
              htmlFor="project-rebind-max-count"
              className={modalFormFieldClassName}
              bodyClassName="mt-3"
            >
              <input
                id="project-rebind-max-count"
                type="number"
                min="0"
                value={
                  manageView.getProjectRebindMaxCountDraft?.(editingRebindProject) ??
                  resolveProjectRebindMaxCountValue(editingRebindProject)
                }
                onChange={(event) =>
                  manageView.onProjectRebindMaxCountChange?.(
                    editingRebindProject.id,
                    event.target.value,
                  )
                }
                className={compactInputClassName}
                placeholder={getInheritedRebindPlaceholder('project', 'maxCount')}
              />
            </DashboardFormField>
          </div>
        ) : null}
      </DashboardModal>
    </div>
  )
}
