import { useState, useCallback } from 'react'

import type { Project } from './dashboard-page-types'
import { parseNullableCooldownMinutesInput, parseNullableMaxCountInput } from './dashboard-form-utils'
import { fromRebindOverrideSelectValue, toRebindOverrideSelectValue } from './license-rebind-policy'
import { normalizeProjectKeyInput, getProjectKeyValidationError } from './project-key'
import { cardTypes } from './dashboard-page-types'

export type UseProjectWorkspaceOptions = {
  projects: Project[]
  onShowMessage?: (message: string, type?: 'success' | 'error') => void
  onLoadingChange?: (loading: boolean) => void
  onFetchProjects?: () => Promise<void>
  onFetchStats?: () => Promise<void>
  onSetProjectWorkspaceTab?: (tab: string) => void
  onSetSelectedProjectKey?: (key: string) => void
  onSetStatsProjectFilter?: (filter: 'all' | string) => void
  onSetConsumptionTrendCompareProjectKey?: (key: 'none' | string) => void
}

export function useProjectWorkspace(options: UseProjectWorkspaceOptions) {
  const {
    projects,
    onShowMessage,
    onLoadingChange,
    onFetchProjects,
    onFetchStats,
    onSetProjectWorkspaceTab,
  } = options

  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectKey, setNewProjectKey] = useState('')
  const [newProjectDescription, setNewProjectDescription] = useState('')
  const [newProjectRebindPolicy, setNewProjectRebindPolicy] = useState<string>('inherit')
  const [newProjectRebindCooldownMinutes, setNewProjectRebindCooldownMinutes] = useState('')
  const [newProjectRebindMaxCount, setNewProjectRebindMaxCount] = useState('')
  const [projectNameDrafts, setProjectNameDrafts] = useState<Record<number, string>>({})
  const [projectDescriptionDrafts, setProjectDescriptionDrafts] = useState<Record<number, string>>({})
  const [projectRebindPolicyDrafts, setProjectRebindPolicyDrafts] = useState<Record<number, string>>({})
  const [projectRebindCooldownMinutesDrafts, setProjectRebindCooldownMinutesDrafts] = useState<Record<number, string>>({})
  const [projectRebindMaxCountDrafts, setProjectRebindMaxCountDrafts] = useState<Record<number, string>>({})
  const [projectManagementCurrentPage, setProjectManagementCurrentPage] = useState(1)

  const handleCreateProject = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const normalizedProjectName = newProjectName.trim()
    const normalizedProjectKey = normalizeProjectKeyInput(newProjectKey)

    if (!normalizedProjectName || !normalizedProjectKey) {
      onShowMessage?.('项目名称和项目标识不能为空', 'error')
      return
    }

    const projectKeyValidationError = getProjectKeyValidationError(normalizedProjectKey)
    if (projectKeyValidationError) {
      onShowMessage?.(projectKeyValidationError, 'error')
      return
    }

    try {
      onLoadingChange?.(true)
      const response = await fetch('/api/admin/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: normalizedProjectName,
          projectKey: normalizedProjectKey,
          description: newProjectDescription,
          allowAutoRebind: fromRebindOverrideSelectValue(newProjectRebindPolicy),
          autoRebindCooldownMinutes: parseNullableCooldownMinutesInput(newProjectRebindCooldownMinutes),
          autoRebindMaxCount: parseNullableMaxCountInput(newProjectRebindMaxCount),
        }),
      })
      const data = await response.json()
      if (data.success) {
        onShowMessage?.(data.message)
        setNewProjectName('')
        setNewProjectKey('')
        setNewProjectDescription('')
        setNewProjectRebindPolicy('inherit')
        setNewProjectRebindCooldownMinutes('')
        setNewProjectRebindMaxCount('')
        onSetProjectWorkspaceTab?.('manage')
        setProjectManagementCurrentPage(1)
        await onFetchProjects?.()
      } else {
        onShowMessage?.(data.message || '项目创建失败', 'error')
      }
    } catch (error) {
      onShowMessage?.(error instanceof Error ? error.message : '网络错误，请重试', 'error')
    } finally {
      onLoadingChange?.(false)
    }
  }, [newProjectName, newProjectKey, newProjectDescription, newProjectRebindPolicy, newProjectRebindCooldownMinutes, newProjectRebindMaxCount, onShowMessage, onLoadingChange, onSetProjectWorkspaceTab, onFetchProjects])

  const handleToggleProjectStatus = useCallback(async (project: Project) => {
    const actionLabel = project.isEnabled ? '停用' : '启用'
    if (!confirm(`确定要${actionLabel}项目「${project.name}」吗？`)) return

    try {
      onLoadingChange?.(true)
      const response = await fetch(`/api/admin/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: !project.isEnabled }),
      })
      const data = await response.json()
      if (data.success) {
        onShowMessage?.(data.message)
        await onFetchProjects?.()
        await onFetchStats?.()
      } else {
        onShowMessage?.(data.message || '更新项目状态失败', 'error')
      }
    } catch (error) {
      onShowMessage?.('网络错误，请重试', 'error')
    } finally {
      onLoadingChange?.(false)
    }
  }, [onShowMessage, onLoadingChange, onFetchProjects, onFetchStats])

  const handleProjectNameChange = useCallback((projectId: number, value: string) => {
    setProjectNameDrafts((current) => ({ ...current, [projectId]: value }))
  }, [])

  const handleSaveProjectName = useCallback(async (project: Project) => {
    try {
      onLoadingChange?.(true)
      const response = await fetch(`/api/admin/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: projectNameDrafts[project.id] ?? project.name }),
      })
      const data = await response.json()
      if (data.success) {
        onShowMessage?.(data.message)
        await onFetchProjects?.()
        await onFetchStats?.()
      } else {
        onShowMessage?.(data.message || '更新项目名称失败', 'error')
      }
    } catch (error) {
      onShowMessage?.('网络错误，请重试', 'error')
    } finally {
      onLoadingChange?.(false)
    }
  }, [projectNameDrafts, onShowMessage, onLoadingChange, onFetchProjects, onFetchStats])

  const handleProjectDescriptionChange = useCallback((projectId: number, value: string) => {
    setProjectDescriptionDrafts((current) => ({ ...current, [projectId]: value }))
  }, [])

  const handleProjectRebindPolicyChange = useCallback((projectId: number, value: string) => {
    setProjectRebindPolicyDrafts((current) => ({ ...current, [projectId]: value }))
  }, [])

  const handleProjectRebindCooldownMinutesChange = useCallback((projectId: number, value: string) => {
    setProjectRebindCooldownMinutesDrafts((current) => ({ ...current, [projectId]: value }))
  }, [])

  const handleProjectRebindMaxCountChange = useCallback((projectId: number, value: string) => {
    setProjectRebindMaxCountDrafts((current) => ({ ...current, [projectId]: value }))
  }, [])

  const handleSaveProjectDescription = useCallback(async (project: Project) => {
    try {
      onLoadingChange?.(true)
      const response = await fetch(`/api/admin/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: projectDescriptionDrafts[project.id] ?? '' }),
      })
      const data = await response.json()
      if (data.success) {
        onShowMessage?.(data.message)
        await onFetchProjects?.()
      } else {
        onShowMessage?.(data.message || '更新项目描述失败', 'error')
      }
    } catch (error) {
      onShowMessage?.('网络错误，请重试', 'error')
    } finally {
      onLoadingChange?.(false)
    }
  }, [projectDescriptionDrafts, onShowMessage, onLoadingChange, onFetchProjects])

  const handleSaveProjectRebindSettings = useCallback(async (project: Project) => {
    try {
      onLoadingChange?.(true)
      const response = await fetch(`/api/admin/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allowAutoRebind: fromRebindOverrideSelectValue(
            projectRebindPolicyDrafts[project.id] ??
              toRebindOverrideSelectValue(project.allowAutoRebind),
          ),
          autoRebindCooldownMinutes: parseNullableCooldownMinutesInput(
            projectRebindCooldownMinutesDrafts[project.id] ??
              (project.autoRebindCooldownMinutes === null
                ? ''
                : String(project.autoRebindCooldownMinutes)),
          ),
          autoRebindMaxCount: parseNullableMaxCountInput(
            projectRebindMaxCountDrafts[project.id] ??
              (project.autoRebindMaxCount === null ? '' : String(project.autoRebindMaxCount)),
          ),
        }),
      })
      const data = await response.json()
      if (data.success) {
        onShowMessage?.(data.message)
        await onFetchProjects?.()
        await onFetchStats?.()
      } else {
        onShowMessage?.(data.message || '更新项目换绑策略失败', 'error')
      }
    } catch (error) {
      onShowMessage?.('网络错误，请重试', 'error')
    } finally {
      onLoadingChange?.(false)
    }
  }, [projectRebindPolicyDrafts, projectRebindCooldownMinutesDrafts, projectRebindMaxCountDrafts, onShowMessage, onLoadingChange, onFetchProjects, onFetchStats])

  const handleDeleteProject = useCallback(async (project: Project) => {
    if (!confirm(`确定要删除项目「${project.name}」吗？该操作不可恢复。`)) return

    try {
      onLoadingChange?.(true)
      const response = await fetch(`/api/admin/projects/${project.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await response.json()
      if (data.success) {
        onShowMessage?.(data.message)
        await onFetchProjects?.()
        await onFetchStats?.()
      } else {
        onShowMessage?.(data.message || '删除项目失败', 'error')
      }
    } catch (error) {
      onShowMessage?.('网络错误，请重试', 'error')
    } finally {
      onLoadingChange?.(false)
    }
  }, [onShowMessage, onLoadingChange, onFetchProjects, onFetchStats])

  return {
    newProjectName,
    setNewProjectName,
    newProjectKey,
    setNewProjectKey,
    newProjectDescription,
    setNewProjectDescription,
    newProjectRebindPolicy,
    setNewProjectRebindPolicy,
    newProjectRebindCooldownMinutes,
    setNewProjectRebindCooldownMinutes,
    newProjectRebindMaxCount,
    setNewProjectRebindMaxCount,
    projectNameDrafts,
    setProjectNameDrafts,
    projectDescriptionDrafts,
    setProjectDescriptionDrafts,
    projectRebindPolicyDrafts,
    setProjectRebindPolicyDrafts,
    projectRebindCooldownMinutesDrafts,
    setProjectRebindCooldownMinutesDrafts,
    projectRebindMaxCountDrafts,
    setProjectRebindMaxCountDrafts,
    projectManagementCurrentPage,
    setProjectManagementCurrentPage,
    handleCreateProject,
    handleToggleProjectStatus,
    handleProjectNameChange,
    handleSaveProjectName,
    handleProjectDescriptionChange,
    handleSaveProjectDescription,
    handleProjectRebindPolicyChange,
    handleProjectRebindCooldownMinutesChange,
    handleProjectRebindMaxCountChange,
    handleSaveProjectRebindSettings,
    handleDeleteProject,
  }
}