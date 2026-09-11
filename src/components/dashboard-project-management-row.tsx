import React from 'react'

import { DashboardInlineActionButton } from './dashboard-inline-action-button'
import { DashboardStatusBadge } from './dashboard-status-badge'

type DashboardProjectManagementRowProps = {
  project: {
    id: number
    name: string
    description?: string | null
    projectKey: string
    isEnabled: boolean
  }
  policySummary: string[]
  loading: boolean
  onCopyProjectKey: () => void
  onEditBasics: () => void
  onEditRebind: () => void
  onToggleStatus: () => void
  onDelete: () => void
}

export function DashboardProjectManagementRow({
  project,
  policySummary,
  loading,
  onCopyProjectKey,
  onEditBasics,
  onEditRebind,
  onToggleStatus,
  onDelete,
}: DashboardProjectManagementRowProps) {
  const isDefaultProject = project.projectKey === 'default'

  return (
    <tr className="transition hover:bg-muted/50">
      <td className="px-6 py-4 text-sm text-foreground">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground">{project.name}</span>
            {isDefaultProject ? (
              <span className="inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                默认项目
              </span>
            ) : null}
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            {project.description?.trim() || '未填写项目描述'}
          </p>
        </div>
      </td>

      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
        <div className="space-y-2">
          <div className="font-mono text-sm text-foreground/90">{project.projectKey}</div>
          <div className="text-xs leading-5 text-muted-foreground">
            {isDefaultProject ? '默认项目不可停用，也不可删除。' : '用于 API 接入、发码隔离与筛选。'}
          </div>
        </div>
      </td>

      <td className="px-6 py-4 text-sm text-muted-foreground">
        <div className="max-w-sm space-y-2">
          {policySummary.map((item) => (
            <div
              key={item}
              className="rounded-md border border-border bg-muted/50 px-4 py-3 text-sm leading-6 text-foreground/80"
            >
              {item}
            </div>
          ))}
        </div>
      </td>

      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
        {project.isEnabled ? (
          <DashboardStatusBadge label="启用中" tone="success" />
        ) : (
          <DashboardStatusBadge label="已停用" tone="neutral" />
        )}
      </td>

      <td className="px-6 py-4 text-sm font-medium">
        <div className="flex flex-wrap gap-2">
          <DashboardInlineActionButton onClick={onCopyProjectKey} disabled={loading}>
            复制标识
          </DashboardInlineActionButton>
          <DashboardInlineActionButton onClick={onEditBasics} disabled={loading}>
            编辑基础信息
          </DashboardInlineActionButton>
          <DashboardInlineActionButton onClick={onEditRebind} disabled={loading}>
            编辑换绑策略
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
