import React from 'react'

import { DashboardInlineActionButton } from './dashboard-inline-action-button'
import { DashboardStatusBadge } from './dashboard-status-badge'

type DashboardProjectManagementRowProps = {
  project: {
    id: number
    projectKey: string
    isEnabled: boolean
  }
  nameValue: string
  descriptionValue: string
  compactInputClassName: string
  loading: boolean
  canSaveName: boolean
  canSaveDescription: boolean
  onNameChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onCopyProjectKey: () => void
  onSaveName: () => void
  onSaveDescription: () => void
  onToggleStatus: () => void
  onDelete: () => void
}

export function DashboardProjectManagementRow({
  project,
  nameValue,
  descriptionValue,
  compactInputClassName,
  loading,
  canSaveName,
  canSaveDescription,
  onNameChange,
  onDescriptionChange,
  onCopyProjectKey,
  onSaveName,
  onSaveDescription,
  onToggleStatus,
  onDelete,
}: DashboardProjectManagementRowProps) {
  const isDefaultProject = project.projectKey === 'default'

  return (
    <tr className="transition hover:bg-slate-50/80">
      <td className="px-6 py-4 text-sm text-gray-900">
        <div className="space-y-2">
          <input
            type="text"
            value={nameValue}
            onChange={(e) => onNameChange(e.target.value)}
            className={`${compactInputClassName} min-w-[180px]`}
            placeholder="项目名称"
            disabled={loading || isDefaultProject}
          />
          {isDefaultProject ? <p className="text-xs text-gray-400">默认项目名称固定</p> : null}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <span className="font-mono">{project.projectKey}</span>
          <DashboardInlineActionButton onClick={onCopyProjectKey} disabled={loading}>
            复制
          </DashboardInlineActionButton>
        </div>
      </td>
      <td className="px-6 py-4 text-sm text-gray-500">
        <input
          type="text"
          value={descriptionValue}
          onChange={(e) => onDescriptionChange(e.target.value)}
          className={`${compactInputClassName} min-w-[220px]`}
          placeholder="项目描述（可选）"
          disabled={loading}
        />
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {project.isEnabled ? (
          <DashboardStatusBadge label="启用中" tone="success" />
        ) : (
          <DashboardStatusBadge label="已停用" tone="neutral" />
        )}
      </td>
      <td className="px-6 py-4 text-sm font-medium">
        <div className="flex flex-wrap gap-2">
          <DashboardInlineActionButton
            onClick={onSaveName}
            disabled={loading || isDefaultProject || !canSaveName}
          >
            保存名称
          </DashboardInlineActionButton>
          <DashboardInlineActionButton onClick={onSaveDescription} disabled={loading || !canSaveDescription}>
            保存描述
          </DashboardInlineActionButton>
          <DashboardInlineActionButton
            onClick={onToggleStatus}
            disabled={loading || (isDefaultProject && project.isEnabled)}
          >
            {project.isEnabled ? '停用' : '启用'}
          </DashboardInlineActionButton>
          {isDefaultProject ? null : (
            <DashboardInlineActionButton onClick={onDelete} disabled={loading}>
              删除
            </DashboardInlineActionButton>
          )}
        </div>
      </td>
    </tr>
  )
}
