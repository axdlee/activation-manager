'use client'

import * as React from 'react'
import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { AdminShell } from '@/components/admin/admin-shell'
import { ConfirmDialog } from '@/components/admin/confirm-dialog'
import { ProjectsPage } from '@/components/admin/projects-page'
import { useOptionalToast } from '@/components/toast-provider'
import {
  buildAdminProjectsFilterQuery,
  parseAdminProjectsFilterQuery,
  type AdminProjectsFilterState,
} from '@/lib/admin-projects-query'
import { buildProjectManagementPage } from '@/lib/project-management-list'
import { useDashboardData } from '@/lib/use-dashboard-data'
import { useProjectWorkspace } from '@/lib/use-project-workspace'

const PAGE_SIZE = 10

type ConfirmRequest = {
  title: string
  targetLabel: string
  description: string
  confirmLabel: string
  destructive: boolean
  resolve: (confirmed: boolean) => void
}

function AdminProjectsContainer() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useOptionalToast()

  const filters = React.useMemo(
    () => parseAdminProjectsFilterQuery(searchParams),
    [searchParams],
  )

  const showMessage = React.useCallback(
    (message: string, type: 'success' | 'error' = 'success') => {
      if (!toast) return
      if (type === 'error') {
        toast.error(message)
      } else {
        toast.success(message)
      }
    },
    [toast],
  )

  const { projects, fetchProjects } = useDashboardData()
  const [pageError, setPageError] = React.useState<string | null>(null)
  const [actionLoading, setActionLoading] = React.useState(false)
  const [confirmRequest, setConfirmRequest] = React.useState<ConfirmRequest | null>(null)

  const requestConfirmation = React.useCallback(
    (message: string) => {
      return new Promise<boolean>((resolve) => {
        setConfirmRequest({
          title: message,
          targetLabel: '',
          description: '该操作会立即生效，请确认影响范围。',
          confirmLabel: '确认',
          destructive: true,
          resolve,
        })
      })
    },
    [],
  )

  const workspace = useProjectWorkspace({
    onShowMessage: showMessage,
    onLoadingChange: setActionLoading,
    onFetchProjects: fetchProjects,
    onConfirmRequest: requestConfirmation,
  })

  const load = React.useCallback(async () => {
    setPageError(null)
    try {
      await fetchProjects()
    } catch {
      setPageError('项目列表加载失败，请重试')
    }
  }, [fetchProjects])

  React.useEffect(() => {
    void load()
  }, [load])

  const updateFilters = React.useCallback(
    (patch: Partial<AdminProjectsFilterState>) => {
      const next = { ...filters, ...patch }
      const query = buildAdminProjectsFilterQuery(next)
      router.replace(query ? `/admin/projects?${query}` : '/admin/projects', { scroll: false })
    },
    [filters, router],
  )

  const page = buildProjectManagementPage(projects, {
    keyword: filters.keyword,
    status: filters.status,
    sortBy: filters.sortBy,
    page: filters.page,
    pageSize: PAGE_SIZE,
  })
  const startIndex =
    page.totalItems === 0 ? 0 : (page.currentPage - 1) * page.pageSize + 1
  const endIndex = Math.min(page.currentPage * page.pageSize, page.totalItems)

  const enabledCount = projects.filter((project) => project.isEnabled).length

  return (
    <>
      <ProjectsPage
        loading={actionLoading}
        error={pageError}
        onRetry={() => void load()}
        summary={{ total: projects.length, enabled: enabledCount, disabled: projects.length - enabledCount }}
        filters={filters}
        onFiltersChange={updateFilters}
        pagination={{
          currentPage: page.currentPage,
          totalPages: page.totalPages,
          totalItems: page.totalItems,
          startIndex,
          endIndex,
        }}
        onPageChange={(nextPage) => updateFilters({ page: nextPage })}
        items={page.items}
        createForm={{
          values: {
            name: workspace.newProjectName,
            projectKey: workspace.newProjectKey,
            description: workspace.newProjectDescription,
            rebindPolicyValue: workspace.newProjectRebindPolicy,
            rebindCooldownMinutesValue: workspace.newProjectRebindCooldownMinutes,
            rebindMaxCountValue: workspace.newProjectRebindMaxCount,
          },
          onValueChange: (patch) => {
            if (patch.name !== undefined) workspace.setNewProjectName(patch.name)
            if (patch.projectKey !== undefined) workspace.setNewProjectKey(patch.projectKey)
            if (patch.description !== undefined) workspace.setNewProjectDescription(patch.description)
            if (patch.rebindPolicyValue !== undefined) workspace.setNewProjectRebindPolicy(patch.rebindPolicyValue)
            if (patch.rebindCooldownMinutesValue !== undefined)
              workspace.setNewProjectRebindCooldownMinutes(patch.rebindCooldownMinutesValue)
            if (patch.rebindMaxCountValue !== undefined)
              workspace.setNewProjectRebindMaxCount(patch.rebindMaxCountValue)
          },
          onSubmit: workspace.handleCreateProject,
        }}
        basics={{
          getDraft: (project) => ({
            name: workspace.projectNameDrafts[project.id] ?? project.name,
            description: workspace.projectDescriptionDrafts[project.id] ?? (project.description || ''),
          }),
          onDraftChange: (projectId, patch) => {
            if (patch.name !== undefined) workspace.handleProjectNameChange(projectId, patch.name)
            if (patch.description !== undefined)
              workspace.handleProjectDescriptionChange(projectId, patch.description)
          },
          isDirty: (project) =>
            (workspace.projectNameDrafts[project.id] ?? project.name).trim() !== project.name.trim() ||
            (workspace.projectDescriptionDrafts[project.id] ?? (project.description || '')).trim() !==
              (project.description || '').trim(),
          save: (project) => {
            void (async () => {
              const nameDraft = workspace.projectNameDrafts[project.id] ?? project.name
              if (nameDraft.trim() !== project.name.trim()) {
                await workspace.handleSaveProjectName({ ...project, name: nameDraft })
              }
              const descriptionDraft =
                workspace.projectDescriptionDrafts[project.id] ?? (project.description || '')
              if (descriptionDraft.trim() !== (project.description || '').trim()) {
                await workspace.handleSaveProjectDescription({ ...project, description: descriptionDraft })
              }
            })()
          },
        }}
        policy={{
          getDraft: (project) => ({
            policyValue:
              workspace.projectRebindPolicyDrafts[project.id] ??
              (project.allowAutoRebind === true
                ? 'enabled'
                : project.allowAutoRebind === false
                  ? 'disabled'
                  : 'inherit'),
            cooldownValue:
              workspace.projectRebindCooldownMinutesDrafts[project.id] ??
              (project.autoRebindCooldownMinutes === null
                ? ''
                : String(project.autoRebindCooldownMinutes)),
            maxCountValue:
              workspace.projectRebindMaxCountDrafts[project.id] ??
              (project.autoRebindMaxCount === null ? '' : String(project.autoRebindMaxCount)),
          }),
          onDraftChange: (projectId, patch) => {
            if (patch.policyValue !== undefined)
              workspace.handleProjectRebindPolicyChange(projectId, patch.policyValue)
            if (patch.cooldownValue !== undefined)
              workspace.handleProjectRebindCooldownMinutesChange(projectId, patch.cooldownValue)
            if (patch.maxCountValue !== undefined)
              workspace.handleProjectRebindMaxCountChange(projectId, patch.maxCountValue)
          },
          isDirty: (project) => {
            const draft = {
              policyValue:
                workspace.projectRebindPolicyDrafts[project.id] ??
                (project.allowAutoRebind === true
                  ? 'enabled'
                  : project.allowAutoRebind === false
                    ? 'disabled'
                    : 'inherit'),
              cooldownValue:
                workspace.projectRebindCooldownMinutesDrafts[project.id] ??
                (project.autoRebindCooldownMinutes === null
                  ? ''
                  : String(project.autoRebindCooldownMinutes)),
              maxCountValue:
                workspace.projectRebindMaxCountDrafts[project.id] ??
                (project.autoRebindMaxCount === null ? '' : String(project.autoRebindMaxCount)),
            }
            return (
              draft.policyValue !==
                (project.allowAutoRebind === true
                  ? 'enabled'
                  : project.allowAutoRebind === false
                    ? 'disabled'
                    : 'inherit') ||
              draft.cooldownValue.trim() !==
                (project.autoRebindCooldownMinutes === null
                  ? ''
                  : String(project.autoRebindCooldownMinutes)) ||
              draft.maxCountValue.trim() !==
                (project.autoRebindMaxCount === null ? '' : String(project.autoRebindMaxCount))
            )
          },
          save: (project) => {
            void workspace.handleSaveProjectRebindSettings(project)
          },
        }}
        onCopyProjectKey={(projectKey) => {
          void navigator.clipboard
            ?.writeText(projectKey)
            .then(() => showMessage('项目标识已复制'))
            .catch(() => showMessage('当前环境不支持自动复制，请手动复制', 'error'))
        }}
        onToggleStatusRequest={(project) => {
          void workspace.handleToggleProjectStatus(project)
        }}
        onDeleteRequest={(project) => {
          void workspace.handleDeleteProject(project)
        }}
      />

      <ConfirmDialog
        open={confirmRequest !== null}
        onOpenChange={(open) => {
          if (!open && confirmRequest) {
            confirmRequest.resolve(false)
            setConfirmRequest(null)
          }
        }}
        title={confirmRequest?.title ?? ''}
        description={confirmRequest?.description}
        confirmLabel={confirmRequest?.confirmLabel}
        destructive={confirmRequest?.destructive}
        loading={actionLoading}
        onConfirm={() => {
          confirmRequest?.resolve(true)
          setConfirmRequest(null)
        }}
      />
    </>
  )
}

export default function AdminProjectsPage() {
  return (
    <AdminShell activeTab="projects">
      <Suspense fallback={null}>
        <AdminProjectsContainer />
      </Suspense>
    </AdminShell>
  )
}
