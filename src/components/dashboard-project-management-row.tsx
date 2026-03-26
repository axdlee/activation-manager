import React from 'react'

import { DashboardInlineActionButton } from './dashboard-inline-action-button'
import { DashboardStatusBadge } from './dashboard-status-badge'

type DashboardProjectManagementRowProps = {
  project: {
    id: number
    projectKey: string
    isEnabled: boolean
    allowAutoRebind?: boolean | null
    autoRebindCooldownMinutes?: number | null
    autoRebindMaxCount?: number | null
  }
  nameValue: string
  descriptionValue: string
  rebindPolicyValue?: string
  rebindCooldownMinutesValue?: string
  rebindMaxCountValue?: string
  compactInputClassName: string
  loading: boolean
  canSaveName: boolean
  canSaveDescription: boolean
  canSaveRebindSettings?: boolean
  onNameChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onRebindPolicyChange?: (value: string) => void
  onRebindCooldownMinutesChange?: (value: string) => void
  onRebindMaxCountChange?: (value: string) => void
  onCopyProjectKey: () => void
  onSaveName: () => void
  onSaveDescription: () => void
  onSaveRebindSettings?: () => void
  onToggleStatus: () => void
  onDelete: () => void
}

function resolvePolicyLabel(value: string) {
  if (value === 'enabled') {
    return '允许自助换绑'
  }

  if (value === 'disabled') {
    return '禁止自助换绑'
  }

  return '继承系统配置'
}

export function DashboardProjectManagementRow({
  project,
  nameValue,
  descriptionValue,
  rebindPolicyValue =
    project.allowAutoRebind === true
      ? 'enabled'
      : project.allowAutoRebind === false
        ? 'disabled'
        : 'inherit',
  rebindCooldownMinutesValue =
    project.autoRebindCooldownMinutes === null || project.autoRebindCooldownMinutes === undefined
      ? ''
      : String(project.autoRebindCooldownMinutes),
  rebindMaxCountValue =
    project.autoRebindMaxCount === null || project.autoRebindMaxCount === undefined
      ? ''
      : String(project.autoRebindMaxCount),
  compactInputClassName,
  loading,
  canSaveName,
  canSaveDescription,
  canSaveRebindSettings = false,
  onNameChange,
  onDescriptionChange,
  onRebindPolicyChange,
  onRebindCooldownMinutesChange,
  onRebindMaxCountChange,
  onCopyProjectKey,
  onSaveName,
  onSaveDescription,
  onSaveRebindSettings,
  onToggleStatus,
  onDelete,
}: DashboardProjectManagementRowProps) {
  const isDefaultProject = project.projectKey === 'default'
  const policyLabel = resolvePolicyLabel(rebindPolicyValue)
  const cooldownHint = rebindCooldownMinutesValue.trim()
    ? `当前冷却 ${rebindCooldownMinutesValue.trim()} 分钟`
    : '冷却时间跟随系统配置'
  const maxCountHint = rebindMaxCountValue.trim()
    ? Number(rebindMaxCountValue.trim()) === 0
      ? '换绑次数不限制'
      : `最多自助换绑 ${rebindMaxCountValue.trim()} 次`
    : '换绑次数跟随系统配置'

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
      <td className="px-6 py-4 text-sm text-gray-500">
        <div className="space-y-2">
          <select
            value={rebindPolicyValue}
            onChange={(event) => onRebindPolicyChange?.(event.target.value)}
            className={`${compactInputClassName} min-w-[220px]`}
            disabled={loading}
          >
            <option value="inherit">继承系统配置</option>
            <option value="enabled">允许自助换绑</option>
            <option value="disabled">禁止自助换绑</option>
          </select>
          <input
            type="number"
            min="0"
            value={rebindCooldownMinutesValue}
            onChange={(event) => onRebindCooldownMinutesChange?.(event.target.value)}
            className={`${compactInputClassName} min-w-[220px]`}
            placeholder="留空则继承系统配置"
            disabled={loading}
          />
          <input
            type="number"
            min="0"
            value={rebindMaxCountValue}
            onChange={(event) => onRebindMaxCountChange?.(event.target.value)}
            className={`${compactInputClassName} min-w-[220px]`}
            placeholder="0 表示不限制；留空则继承系统配置"
            disabled={loading}
          />
          <div className="space-y-1 text-xs text-slate-500">
            <p>{policyLabel}</p>
            <p>{cooldownHint}</p>
            <p>{maxCountHint}</p>
          </div>
        </div>
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
            onClick={onSaveRebindSettings}
            disabled={loading || !canSaveRebindSettings}
          >
            保存换绑策略
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
