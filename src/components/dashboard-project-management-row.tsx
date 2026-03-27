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
    <tr className="transition hover:bg-slate-50/80">
      <td className="px-6 py-4 text-sm text-slate-900">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-900">{project.name}</span>
            {isDefaultProject ? (
              <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700">
                默认项目
              </span>
            ) : null}
          </div>
          <p className="text-sm leading-6 text-slate-500">
            {project.description?.trim() || '未填写项目描述'}
          </p>
        </div>
      </td>

      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
        <div className="space-y-2">
          <div className="font-mono text-sm text-slate-700">{project.projectKey}</div>
          <div className="text-xs leading-5 text-slate-400">
            {isDefaultProject ? '默认项目不可停用，也不可删除。' : '用于 API 接入、发码隔离与筛选。'}
          </div>
        </div>
      </td>

      <td className="px-6 py-4 text-sm text-slate-500">
        <div className="max-w-sm space-y-2">
          {policySummary.map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600"
            >
              {item}
            </div>
          ))}
        </div>
      </td>

      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
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
