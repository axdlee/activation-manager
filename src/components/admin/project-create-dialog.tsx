'use client'

import * as React from 'react'
import { X } from 'lucide-react'

import type { ProjectManagementListItem } from '@/lib/project-management-list'
import {
  PROJECT_KEY_ALLOWED_PATTERN,
  PROJECT_KEY_MAX_LENGTH,
  PROJECT_KEY_MIN_LENGTH,
  PROJECT_KEY_RULE_HINT_KEY,
} from '@/lib/project-key'
import {
  getInheritedRebindPlaceholder,
  getInheritedRebindPolicyOptionLabel,
  getScopedRebindCooldownLabel,
  getScopedRebindMaxCountLabel,
  getScopedRebindPolicyLabel,
} from '@/lib/rebind-policy-ui'
import { useI18n } from '@/lib/i18n/i18n-provider'

export type ProjectFormValues = {
  name: string
  projectKey: string
  description: string
  rebindPolicyValue: string
  rebindCooldownMinutesValue: string
  rebindMaxCountValue: string
}

export type ProjectCreateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  loading?: boolean
  /** create = 新建项目；edit-basics = 复用同一 Dialog 编辑基础信息 */
  mode?: 'create' | 'edit-basics'
  values: ProjectFormValues
  onValueChange: (patch: Partial<ProjectFormValues>) => void
  /** 仅 create 模式使用（表单 submit） */
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void
  /** 仅 edit-basics 模式使用 */
  editingProject?: ProjectManagementListItem | null
  basicsDirty?: boolean
  onSaveBasics?: () => void
  onCopyProjectKey?: (projectKey: string) => void
}

const fieldClassName =
  'w-full h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60'

/**
 * 项目创建 / 基础信息编辑共用 Dialog。
 * - Escape / 遮罩关闭，打开时焦点进入面板（role=dialog + aria-labelledby）
 * - create 模式保留既有 DOM 契约：#create-project-form、#create-project-name 等
 * - edit-basics 模式保留 #project-modal-name 与「保存基础信息」入口
 */
export function ProjectCreateDialog({
  open,
  onOpenChange,
  loading = false,
  mode = 'create',
  values,
  onValueChange,
  onSubmit,
  editingProject = null,
  basicsDirty = false,
  onSaveBasics,
  onCopyProjectKey,
}: ProjectCreateDialogProps) {
  const { t } = useI18n()
  const titleId = React.useId()
  const descriptionId = React.useId()
  const panelRef = React.useRef<HTMLDivElement | null>(null)
  const isEditBasics = mode === 'edit-basics'
  const title = isEditBasics
    ? t('adminProjects.editBasicsTitle', '编辑基础信息')
    : t('adminProjects.createTitle', '新建项目')

  React.useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const frame = window.requestAnimationFrame(() => {
      panelRef.current?.focus()
    })
    return () => {
      window.cancelAnimationFrame(frame)
      previous?.focus?.()
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

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
      <button
        type="button"
        aria-label={t('adminProjects.closeDialog', '关闭对话框')}
        onClick={() => onOpenChange(false)}
        className="absolute inset-0 bg-black/60"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border bg-card shadow-lg outline-none animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-start justify-between gap-4 border-b px-6 py-4">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-foreground">
              {editingProject && isEditBasics ? `${title} · ${editingProject.name}` : title}
            </h2>
            <p id={descriptionId} className="mt-1 text-sm text-muted-foreground">
              {isEditBasics
                ? t('adminProjects.editBasicsDesc', '维护项目名称与描述，保存后立即生效。')
                : t('adminProjects.createDesc', '创建 projectKey 并设定项目级默认换绑策略。')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label={t('adminProjects.closeDialog', '关闭对话框')}
            className="rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {isEditBasics ? (
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div className="space-y-1.5">
              <label htmlFor="project-modal-name" className="text-sm font-medium text-foreground">
                {t('adminProjects.nameLabel', '项目名称')}
              </label>
              <input
                id="project-modal-name"
                type="text"
                value={values.name}
                onChange={(event) => onValueChange({ name: event.target.value })}
                className={fieldClassName}
                placeholder={t('adminProjects.namePlaceholder', '项目名称')}
                disabled={loading || editingProject?.projectKey === 'default'}
              />
              {editingProject?.projectKey === 'default' ? (
                <p className="text-xs text-muted-foreground">
                  {t('adminProjects.defaultNameHint', '默认项目名称固定，仅可维护描述。')}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="project-modal-key" className="text-sm font-medium text-foreground">
                {t('adminProjects.keyLabel', '项目标识')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="project-modal-key"
                  type="text"
                  value={editingProject?.projectKey ?? ''}
                  readOnly
                  disabled
                  className={fieldClassName}
                />
                <button
                  type="button"
                  onClick={() => editingProject && onCopyProjectKey?.(editingProject.projectKey)}
                  className="inline-flex h-10 shrink-0 items-center rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent"
                >
                  {t('adminProjects.copyKey', '复制标识')}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="project-modal-description" className="text-sm font-medium text-foreground">
                {t('adminProjects.descriptionLabel', '项目描述')}
              </label>
              <textarea
                id="project-modal-description"
                value={values.description}
                onChange={(event) => onValueChange({ description: event.target.value })}
                className={`${fieldClassName} h-auto min-h-[110px] resize-y py-2`}
                placeholder={t('adminProjects.descriptionPlaceholder', '项目描述（可选）')}
              />
            </div>
          </div>
        ) : (
          <form id="create-project-form" onSubmit={onSubmit} className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div className="space-y-1.5">
              <label htmlFor="create-project-name" className="text-sm font-medium text-foreground">
                {t('adminProjects.nameLabel', '项目名称')}
              </label>
              <input
                id="create-project-name"
                type="text"
                value={values.name}
                onChange={(event) => onValueChange({ name: event.target.value })}
                className={fieldClassName}
                placeholder={t('adminProjects.namePlaceholder', '项目名称')}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="create-project-key" className="text-sm font-medium text-foreground">
                {t('adminProjects.keyLabel', '项目标识')}
              </label>
              <input
                id="create-project-key"
                type="text"
                value={values.projectKey}
                onChange={(event) => onValueChange({ projectKey: event.target.value })}
                className={fieldClassName}
                placeholder={t('adminProjects.keyPlaceholder', '项目标识，例如 browser-plugin')}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                pattern={PROJECT_KEY_ALLOWED_PATTERN.source}
                minLength={PROJECT_KEY_MIN_LENGTH}
                maxLength={PROJECT_KEY_MAX_LENGTH}
                required
              />
              <p className="text-xs text-muted-foreground">
                {t(PROJECT_KEY_RULE_HINT_KEY)}
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="create-project-description" className="text-sm font-medium text-foreground">
                {t('adminProjects.descriptionLabel', '项目描述')}
              </label>
              <textarea
                id="create-project-description"
                value={values.description}
                onChange={(event) => onValueChange({ description: event.target.value })}
                className={`${fieldClassName} h-auto min-h-[90px] resize-y py-2`}
                placeholder={t('adminProjects.descriptionPlaceholder', '项目描述（可选）')}
              />
            </div>

            <section className="rounded-lg border bg-muted/40 p-4">
              <h3 className="text-sm font-semibold text-foreground">
                {t('adminProjects.policySection', '默认换绑策略')}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('adminProjects.policySectionDesc', '作为项目级默认值，发码与单码配置可继承或覆盖。')}
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <label htmlFor="create-project-rebind-policy" className="text-xs font-medium text-foreground">
                    {getScopedRebindPolicyLabel('project')}
                  </label>
                  <select
                    id="create-project-rebind-policy"
                    value={values.rebindPolicyValue}
                    onChange={(event) => onValueChange({ rebindPolicyValue: event.target.value })}
                    className={fieldClassName}
                  >
                    <option value="inherit">{getInheritedRebindPolicyOptionLabel('project')}</option>
                    <option value="enabled">{t('adminProjects.rebindAllowed', '允许自助换绑')}</option>
                    <option value="disabled">{t('adminProjects.rebindForbidden', '禁止自助换绑')}</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="create-project-rebind-cooldown" className="text-xs font-medium text-foreground">
                    {getScopedRebindCooldownLabel('project')}
                  </label>
                  <input
                    id="create-project-rebind-cooldown"
                    type="number"
                    min="0"
                    value={values.rebindCooldownMinutesValue}
                    onChange={(event) => onValueChange({ rebindCooldownMinutesValue: event.target.value })}
                    className={fieldClassName}
                    placeholder={getInheritedRebindPlaceholder('project', 'cooldown')}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="create-project-rebind-max-count" className="text-xs font-medium text-foreground">
                    {getScopedRebindMaxCountLabel('project')}
                  </label>
                  <input
                    id="create-project-rebind-max-count"
                    type="number"
                    min="0"
                    value={values.rebindMaxCountValue}
                    onChange={(event) => onValueChange({ rebindMaxCountValue: event.target.value })}
                    className={fieldClassName}
                    placeholder={getInheritedRebindPlaceholder('project', 'maxCount')}
                  />
                </div>
              </div>
            </section>
          </form>
        )}

        <div className="flex items-center justify-end gap-2 border-t px-6 py-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent"
          >
            {t('adminProjects.cancel', '取消')}
          </button>
          {isEditBasics ? (
            <button
              type="button"
              onClick={onSaveBasics}
              disabled={!basicsDirty || loading}
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? t('adminProjects.saving', '保存中…')
                : t('adminProjects.saveBasics', '保存基础信息')}
            </button>
          ) : (
            <button
              type="submit"
              form="create-project-form"
              disabled={loading}
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? t('adminProjects.creating', '创建中…') : t('adminProjects.createSubmit', '创建项目')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
