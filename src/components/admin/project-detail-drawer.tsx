'use client'

import * as React from 'react'
import { X } from 'lucide-react'

import type { ProjectManagementListItem } from '@/lib/project-management-list'
import {
  getInheritedRebindPlaceholder,
  getInheritedRebindPolicyOptionLabel,
  getScopedRebindCooldownLabel,
  getScopedRebindMaxCountLabel,
  getScopedRebindPolicyLabel,
} from '@/lib/rebind-policy-ui'
import { useI18n } from '@/lib/i18n/i18n-provider'

export type ProjectPolicyDraft = {
  policyValue: string
  cooldownValue: string
  maxCountValue: string
}

export type ProjectDetailDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: ProjectManagementListItem | null
  policyDraft: ProjectPolicyDraft
  onPolicyDraftChange: (patch: Partial<ProjectPolicyDraft>) => void
  policyDirty?: boolean
  loading?: boolean
  onSavePolicy?: () => void
  onCopyProjectKey?: (projectKey: string) => void
  onEditBasics?: (project: ProjectManagementListItem) => void
  onToggleStatusRequest?: (project: ProjectManagementListItem) => void
  onDeleteRequest?: (project: ProjectManagementListItem) => void
}

const fieldClassName =
  'w-full h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/**
 * 项目详情 Drawer：概要 + 策略 section + 危险操作。
 * 行内不放策略长文本；换绑策略统一在这里维护。
 */
export function ProjectDetailDrawer({
  open,
  onOpenChange,
  project,
  policyDraft,
  onPolicyDraftChange,
  policyDirty = false,
  loading = false,
  onSavePolicy,
  onCopyProjectKey,
  onEditBasics,
  onToggleStatusRequest,
  onDeleteRequest,
}: ProjectDetailDrawerProps) {
  const { t } = useI18n()
  const titleId = React.useId()
  const restoreFocusRef = React.useRef<HTMLElement | null>(null)

  React.useEffect(() => {
    if (open) {
      restoreFocusRef.current = document.activeElement as HTMLElement | null
    } else if (restoreFocusRef.current) {
      restoreFocusRef.current.focus?.()
      restoreFocusRef.current = null
    }
  }, [open])

  React.useEffect(() => {
    if (!open) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [open, onOpenChange])

  if (!open || !project) return null

  const isDefaultProject = project.projectKey === 'default'

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button
        type="button"
        aria-label={t('adminProjects.closeDetail', '关闭详情')}
        onClick={() => onOpenChange(false)}
        className="absolute inset-0 bg-black/50"
      />
      <div className="absolute inset-y-0 right-0 flex w-full flex-col border-l bg-card shadow-lg animate-in slide-in-from-right duration-200" style={{ maxWidth: 480 }}>
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-base font-semibold text-foreground">
              {project.name}
            </h2>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">{project.projectKey}</p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label={t('adminProjects.closeDetail', '关闭详情')}
            className="shrink-0 rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">{t('adminProjects.overviewSection', '概要')}</h3>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">{t('adminProjects.statusLabel', '状态')}</dt>
              <dd>
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
              </dd>
              <dt className="text-muted-foreground">{t('adminProjects.createdAtLabel', '创建时间')}</dt>
              <dd className="tabular-nums text-foreground/90">
                {new Date(project.createdAt).toLocaleString()}
              </dd>
              {project.description ? (
                <>
                  <dt className="text-muted-foreground">{t('adminProjects.descriptionLabel', '项目描述')}</dt>
                  <dd className="whitespace-pre-wrap text-foreground/90">{project.description}</dd>
                </>
              ) : null}
            </dl>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => onEditBasics?.(project)}
                className="inline-flex h-10 items-center rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent"
              >
                {t('adminProjects.editBasics', '编辑基础信息')}
              </button>
              <button
                type="button"
                onClick={() => onCopyProjectKey?.(project.projectKey)}
                className="inline-flex h-10 items-center rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent"
              >
                {t('adminProjects.copyKey', '复制标识')}
              </button>
            </div>
          </section>

          <section className="space-y-3 rounded-lg border bg-muted/40 p-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">{t('adminProjects.policySectionTitle', '换绑策略')}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('adminProjects.policySectionHint', '项目级默认规则；单码未覆盖时以此为准。')}
              </p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="project-detail-rebind-policy" className="text-xs font-medium text-foreground">
                {getScopedRebindPolicyLabel('project')}
              </label>
              <select
                id="project-detail-rebind-policy"
                value={policyDraft.policyValue}
                onChange={(event) => onPolicyDraftChange({ policyValue: event.target.value })}
                className={fieldClassName}
              >
                <option value="inherit">{getInheritedRebindPolicyOptionLabel('project')}</option>
                <option value="enabled">{t('adminProjects.rebindAllowed', '允许自助换绑')}</option>
                <option value="disabled">{t('adminProjects.rebindForbidden', '禁止自助换绑')}</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="project-detail-rebind-cooldown" className="text-xs font-medium text-foreground">
                  {getScopedRebindCooldownLabel('project')}
                </label>
                <input
                  id="project-detail-rebind-cooldown"
                  type="number"
                  min="0"
                  value={policyDraft.cooldownValue}
                  onChange={(event) => onPolicyDraftChange({ cooldownValue: event.target.value })}
                  className={fieldClassName}
                  placeholder={getInheritedRebindPlaceholder('project', 'cooldown')}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="project-detail-rebind-max-count" className="text-xs font-medium text-foreground">
                  {getScopedRebindMaxCountLabel('project')}
                </label>
                <input
                  id="project-detail-rebind-max-count"
                  type="number"
                  min="0"
                  value={policyDraft.maxCountValue}
                  onChange={(event) => onPolicyDraftChange({ maxCountValue: event.target.value })}
                  className={fieldClassName}
                  placeholder={getInheritedRebindPlaceholder('project', 'maxCount')}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={onSavePolicy}
              disabled={!policyDirty || loading}
              className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? t('adminProjects.saving', '保存中…') : t('adminProjects.savePolicy', '保存策略')}
            </button>
          </section>

          <section className="space-y-2 rounded-lg border border-destructive/30 p-4">
            <h3 className="text-sm font-semibold text-foreground">{t('adminProjects.dangerSection', '危险操作')}</h3>
            {isDefaultProject ? (
              <p className="text-xs text-muted-foreground">
                {t('adminProjects.defaultProjectHint', '默认项目不可停用：它承接未指定 projectKey 的兼容发码。')}
              </p>
            ) : (
              <button
                type="button"
                onClick={() => onToggleStatusRequest?.(project)}
                className="inline-flex h-10 w-full items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent"
              >
                {project.isEnabled
                  ? t('adminProjects.disableProject', '停用项目')
                  : t('adminProjects.enableProject', '启用项目')}
              </button>
            )}
            <button
              type="button"
              onClick={() => onDeleteRequest?.(project)}
              className="inline-flex h-10 w-full items-center justify-center rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground shadow-sm transition hover:bg-destructive/90"
            >
              {t('adminProjects.deleteProject', '删除项目')}
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}
