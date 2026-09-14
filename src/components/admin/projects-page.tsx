'use client'

import * as React from 'react'
import { MoreHorizontal, Plus, RefreshCw, Search } from 'lucide-react'

import { PageHeader } from '@/components/admin/page-header'
import { PageToolbar } from '@/components/admin/page-toolbar'
import { ProjectCreateDialog, type ProjectFormValues } from '@/components/admin/project-create-dialog'
import {
  ProjectDetailDrawer,
  type ProjectPolicyDraft,
} from '@/components/admin/project-detail-drawer'
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
import type { AdminProjectsFilterState } from '@/lib/admin-projects-query'
import type { ProjectManagementListItem } from '@/lib/project-management-list'
import { useI18n } from '@/lib/i18n/i18n-provider'

export type ProjectsPageBasicsApi = {
  getDraft: (project: ProjectManagementListItem) => { name: string; description: string }
  onDraftChange: (
    projectId: number,
    patch: { name?: string; description?: string },
  ) => void
  isDirty: (project: ProjectManagementListItem) => boolean
  save: (project: ProjectManagementListItem) => void
}

export type ProjectsPagePolicyApi = {
  getDraft: (project: ProjectManagementListItem) => ProjectPolicyDraft
  onDraftChange: (projectId: number, patch: Partial<ProjectPolicyDraft>) => void
  isDirty: (project: ProjectManagementListItem) => boolean
  save: (project: ProjectManagementListItem) => void
}

export type ProjectsPageProps = {
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  summary: { total: number; enabled: number; disabled: number }
  filters: AdminProjectsFilterState
  onFiltersChange: (patch: Partial<AdminProjectsFilterState>) => void
  pagination: {
    currentPage: number
    totalPages: number
    totalItems: number
    startIndex: number
    endIndex: number
  }
  onPageChange: (page: number) => void
  items: ProjectManagementListItem[]
  createForm: {
    values: ProjectFormValues
    onValueChange: (patch: Partial<ProjectFormValues>) => void
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  }
  basics: ProjectsPageBasicsApi
  policy: ProjectsPagePolicyApi
  onCopyProjectKey: (projectKey: string) => void
  onToggleStatusRequest: (project: ProjectManagementListItem) => void
  onDeleteRequest: (project: ProjectManagementListItem) => void
}

const toolbarFieldClassName =
  'h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/**
 * 项目管理任务页：列表优先，创建/基础编辑共用 Dialog，策略进详情 Drawer。
 * 筛选/分页状态由容器同步到 URL query。
 */
export function ProjectsPage({
  loading = false,
  error = null,
  onRetry,
  summary,
  filters,
  onFiltersChange,
  pagination,
  onPageChange,
  items,
  createForm,
  basics,
  policy,
  onCopyProjectKey,
  onToggleStatusRequest,
  onDeleteRequest,
}: ProjectsPageProps) {
  const { t } = useI18n()
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [shouldCloseAfterCreate, setShouldCloseAfterCreate] = React.useState(false)
  const [editingProject, setEditingProject] = React.useState<ProjectManagementListItem | null>(null)
  const [detailProject, setDetailProject] = React.useState<ProjectManagementListItem | null>(null)

  const isCreateFormPristine =
    createForm.values.name === '' &&
    createForm.values.projectKey === '' &&
    createForm.values.description === '' &&
    createForm.values.rebindPolicyValue === 'inherit' &&
    createForm.values.rebindCooldownMinutesValue === '' &&
    createForm.values.rebindMaxCountValue === ''

  // 创建成功（loading 结束且表单回到 pristine）后自动关闭 Dialog
  React.useEffect(() => {
    if (loading || !shouldCloseAfterCreate) return
    if (isCreateFormPristine) {
      setIsCreateOpen(false)
    }
    setShouldCloseAfterCreate(false)
  }, [isCreateFormPristine, loading, shouldCloseAfterCreate])

  const handleSubmitCreateForm = (event: React.FormEvent<HTMLFormElement>) => {
    setShouldCloseAfterCreate(true)
    createForm.onSubmit(event)
  }

  const openEditBasics = (project: ProjectManagementListItem) => {
    setDetailProject(null)
    setEditingProject(project)
  }

  const editDraft = editingProject ? basics.getDraft(editingProject) : { name: '', description: '' }
  const detailPolicyDraft = detailProject ? policy.getDraft(detailProject) : null

  const paginationSummary = t('adminProjects.paginationSummary', '第 {page} / {totalPages} 页 · 共 {total} 条')
    .replace('{page}', String(pagination.currentPage))
    .replace('{totalPages}', String(pagination.totalPages))
    .replace('{total}', String(pagination.totalItems))

  return (
    <>
      <PageHeader
        title={t('adminProjects.title', '项目')}
        description={t('adminProjects.description', '管理 projectKey 与项目级默认换绑策略。')}
        actions={
          <>
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {t('adminProjects.summaryBadge', '启用 {enabled} · 停用 {disabled}')
                .replace('{enabled}', String(summary.enabled))
                .replace('{disabled}', String(summary.disabled))}
            </span>
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" aria-hidden />
              {t('adminProjects.create', '新建项目')}
            </button>
          </>
        }
      />

      {error ? (
        <ErrorState message={error} retry={onRetry} className="mb-4" />
      ) : null}

      <PageToolbar
        className="mb-4"
        filters={
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                type="text"
                aria-label={t('adminProjects.searchLabel', '搜索项目')}
                value={filters.keyword}
                onChange={(event) => onFiltersChange({ keyword: event.target.value })}
                placeholder={t('adminProjects.searchPlaceholder', '名称 / projectKey / 描述')}
                className={`${toolbarFieldClassName} w-56 pl-9`}
              />
            </div>
            <select
              aria-label={t('adminProjects.statusFilterLabel', '状态筛选')}
              value={filters.status}
              onChange={(event) =>
                onFiltersChange({ status: event.target.value as AdminProjectsFilterState['status'] })
              }
              className={toolbarFieldClassName}
            >
              <option value="all">{t('adminProjects.statusAll', '全部状态')}</option>
              <option value="enabled">{t('adminProjects.statusEnabled', '启用中')}</option>
              <option value="disabled">{t('adminProjects.statusDisabled', '已停用')}</option>
            </select>
            <select
              aria-label={t('adminProjects.sortLabel', '排序方式')}
              value={filters.sortBy}
              onChange={(event) =>
                onFiltersChange({ sortBy: event.target.value as AdminProjectsFilterState['sortBy'] })
              }
              className={toolbarFieldClassName}
            >
              <option value="createdAtDesc">{t('adminProjects.sortCreatedAtDesc', '最新创建')}</option>
              <option value="createdAtAsc">{t('adminProjects.sortCreatedAtAsc', '最早创建')}</option>
              <option value="nameAsc">{t('adminProjects.sortNameAsc', '名称 A-Z')}</option>
              <option value="nameDesc">{t('adminProjects.sortNameDesc', '名称 Z-A')}</option>
            </select>
          </>
        }
        actions={
          <button
            type="button"
            onClick={onRetry}
            aria-label={t('adminProjects.refresh', '刷新列表')}
            title={t('adminProjects.refresh', '刷新列表')}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-input bg-background text-foreground shadow-sm transition hover:bg-accent"
          >
            <RefreshCw className={`h-4 w-4${loading ? ' animate-spin' : ''}`} aria-hidden />
          </button>
        }
      />

      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-4 py-3 font-medium">{t('adminProjects.columnName', '项目')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('adminProjects.columnKey', '项目标识')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('adminProjects.columnStatus', '状态')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('adminProjects.columnActivity', '最近活动')}</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  <span className="sr-only">{t('adminProjects.columnActions', '操作')}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading && items.length === 0
                ? Array.from({ length: 3 }).map((_, index) => (
                    <tr key={index}>
                      <td colSpan={5} className="px-4 py-3">
                        <Skeleton className="h-8 w-full" />
                      </td>
                    </tr>
                  ))
                : items.map((project) => {
                    const isDefaultProject = project.projectKey === 'default'
                    return (
                      <tr key={project.id} className="transition hover:bg-muted/30">
                        <td className="max-w-[240px] px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setDetailProject(project)}
                            className="block max-w-full truncate text-left font-medium text-foreground hover:underline"
                            title={project.name}
                          >
                            {project.name}
                          </button>
                          {isDefaultProject ? (
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {t('adminProjects.defaultProjectAux', '默认项目不可停用')}
                            </span>
                          ) : project.description ? (
                            <span className="mt-0.5 block max-w-[220px] truncate text-xs text-muted-foreground">
                              {project.description}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => onCopyProjectKey(project.projectKey)}
                            className="font-mono text-xs text-muted-foreground transition hover:text-foreground"
                            title={t('adminProjects.copyKey', '复制标识')}
                          >
                            {project.projectKey}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              project.isEnabled
                                ? 'inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600'
                                : 'inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground'
                            }
                          >
                            {project.isEnabled
                              ? t('adminProjects.statusEnabled', '启用中')
                              : t('adminProjects.statusDisabled', '已停用')}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted-foreground">
                          {new Date(project.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right" onClick={(event) => event.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                aria-label={t('adminProjects.moreActions', '更多操作')}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
                              >
                                <MoreHorizontal className="h-4 w-4" aria-hidden />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onSelect={() => openEditBasics(project)}>
                                {t('adminProjects.editBasics', '编辑基础信息')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => setDetailProject(project)}>
                                {t('adminProjects.openDetail', '项目详情')}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onSelect={() => onToggleStatusRequest(project)}>
                                {project.isEnabled
                                  ? t('adminProjects.disableAction', '停用')
                                  : t('adminProjects.enableAction', '启用')}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onSelect={() => onDeleteRequest(project)}
                              >
                                {t('adminProjects.deleteAction', '删除')}
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

        {!loading && items.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title={
                filters.keyword || filters.status !== 'all'
                  ? t('adminProjects.emptyFiltered', '没有匹配的项目')
                  : t('adminProjects.empty', '还没有项目')
              }
              description={
                filters.keyword || filters.status !== 'all'
                  ? t('adminProjects.emptyFilteredDesc', '调整搜索关键词或状态筛选后重试。')
                  : t('adminProjects.emptyDesc', '创建第一个项目后，即可为它生成激活码。')
              }
              action={
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(true)}
                  className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  {t('adminProjects.create', '新建项目')}
                </button>
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
                {t('adminProjects.prevPage', '上一页')}
              </button>
              <button
                type="button"
                onClick={() => onPageChange(pagination.currentPage + 1)}
                disabled={pagination.currentPage >= pagination.totalPages}
                className="inline-flex h-10 items-center rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('adminProjects.nextPage', '下一页')}
              </button>
            </span>
          ) : null}
        </div>
      </div>

      <ProjectCreateDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        loading={loading}
        mode="create"
        values={createForm.values}
        onValueChange={createForm.onValueChange}
        onSubmit={handleSubmitCreateForm}
      />

      <ProjectCreateDialog
        open={editingProject !== null}
        onOpenChange={(open) => {
          if (!open) setEditingProject(null)
        }}
        loading={loading}
        mode="edit-basics"
        values={{
          name: editDraft.name,
          projectKey: editingProject?.projectKey ?? '',
          description: editDraft.description,
          rebindPolicyValue: 'inherit',
          rebindCooldownMinutesValue: '',
          rebindMaxCountValue: '',
        }}
        onValueChange={(patch) => {
          if (!editingProject) return
          basics.onDraftChange(editingProject.id, {
            name: patch.name,
            description: patch.description,
          })
        }}
        editingProject={editingProject}
        basicsDirty={editingProject ? basics.isDirty(editingProject) : false}
        onSaveBasics={() => {
          if (editingProject) {
            basics.save(editingProject)
            setEditingProject(null)
          }
        }}
        onCopyProjectKey={onCopyProjectKey}
      />

      <ProjectDetailDrawer
        open={detailProject !== null}
        onOpenChange={(open) => {
          if (!open) setDetailProject(null)
        }}
        project={detailProject}
        policyDraft={detailPolicyDraft ?? { policyValue: 'inherit', cooldownValue: '', maxCountValue: '' }}
        onPolicyDraftChange={(patch) => {
          if (detailProject) policy.onDraftChange(detailProject.id, patch)
        }}
        policyDirty={detailProject ? policy.isDirty(detailProject) : false}
        loading={loading}
        onSavePolicy={() => {
          if (detailProject) policy.save(detailProject)
        }}
        onCopyProjectKey={onCopyProjectKey}
        onEditBasics={openEditBasics}
        onToggleStatusRequest={(project) => {
          setDetailProject(null)
          onToggleStatusRequest(project)
        }}
        onDeleteRequest={(project) => {
          setDetailProject(null)
          onDeleteRequest(project)
        }}
      />
    </>
  )
}

// ConfirmDialog 由容器（page.tsx）挂载，这里仅导出类型方便复用
export type { ProjectPolicyDraft }
