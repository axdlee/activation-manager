'use client'

import * as React from 'react'
import { X } from 'lucide-react'

import {
  getInheritedRebindPlaceholder,
  getInheritedRebindPolicyOptionLabel,
} from '@/lib/rebind-policy-ui'
import { getAdminOperationTypeLabel } from '@/lib/admin-audit-log-ui'
import type { ActivationCode } from '@/lib/dashboard-page-types'
import type { LicenseModeValue } from '@/lib/license-status'
import { useI18n } from '@/lib/i18n/i18n-provider'

/** 详情所需字段（完整 ActivationCode 兼容此类型）。 */
export type LicenseCodeDetail = {
  code: string
  licenseMode: LicenseModeValue
  createdAt: string
  usedBy?: string | null
  project?: { name: string; projectKey: string } | null
  bindingHistories?: ActivationCode['bindingHistories']
  adminAuditLogs?: ActivationCode['adminAuditLogs']
}

export type LicensePolicyDraft = {
  policyValue: string
  cooldownValue: string
  maxCountValue: string
  reason: string
}

export type LicenseDetailDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  detail: LicenseCodeDetail | null
  policyDraft: LicensePolicyDraft
  onPolicyDraftChange: (patch: Partial<LicensePolicyDraft>) => void
  policyDirty?: boolean
  machineTarget: string
  onMachineTargetChange: (value: string) => void
  loading?: boolean
  onSavePolicy?: () => void
  onForceUnbind?: () => void
  onForceRebind?: () => void
  onDelete?: () => void
  onCopyCode?: (code: string) => void
}

const fieldClassName =
  'w-full h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

function getBindingHistoryTitle(eventType: string, t: (key: string, fallback?: string) => string) {
  if (eventType === 'AUTO_REBIND') return t('licenseDetail.historyAutoRebind', '自动换绑')
  if (eventType === 'FORCE_UNBIND') return t('licenseDetail.historyForceUnbind', '管理员强制解绑')
  if (eventType === 'FORCE_REBIND') return t('licenseDetail.historyForceRebind', '管理员强制换绑')
  if (eventType === 'REUSABLE_BINDING_RELEASED') return t('licenseDetail.historyReleased', '系统释放旧绑定')
  return t('licenseDetail.historyFirstBind', '首次绑定')
}

/**
 * 激活码详情 Drawer：概要 + 单码换绑策略 + 绑定历史/管理员审计时间线 + 危险操作。
 * 列表行不再嵌套管理面板；换绑/设备操作统一在此完成。
 */
export function LicenseDetailDrawer({
  open,
  onOpenChange,
  detail,
  policyDraft,
  onPolicyDraftChange,
  policyDirty = false,
  machineTarget,
  onMachineTargetChange,
  loading = false,
  onSavePolicy,
  onForceUnbind,
  onForceRebind,
  onDelete,
  onCopyCode,
}: LicenseDetailDrawerProps) {
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

  if (!open || !detail) return null

  const bindingHistories = detail.bindingHistories ?? []
  const adminAuditLogs = detail.adminAuditLogs ?? []

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button
        type="button"
        aria-label={t('licenseDetail.close', '关闭详情')}
        onClick={() => onOpenChange(false)}
        className="absolute inset-0 bg-black/50"
      />
      <div
        className="absolute inset-y-0 right-0 flex w-full flex-col border-l bg-card shadow-lg animate-in slide-in-from-right duration-200"
        style={{ maxWidth: 520 }}
      >
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate font-mono text-base font-semibold text-foreground">
              {detail.code}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {detail.project ? `${detail.project.name} · ${detail.project.projectKey}` : '—'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label={t('licenseDetail.close', '关闭详情')}
            className="shrink-0 rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">{t('licenseDetail.overviewSection', '概要')}</h3>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">{t('licenseDetail.modeLabel', '授权类型')}</dt>
              <dd>{detail.licenseMode === 'TIME' ? t('licenseDetail.modeTime', '时间型') : t('licenseDetail.modeCount', '次数型')}</dd>
              <dt className="text-muted-foreground">{t('licenseDetail.createdAtLabel', '创建时间')}</dt>
              <dd className="tabular-nums">{new Date(detail.createdAt).toLocaleString()}</dd>
              <dt className="text-muted-foreground">{t('licenseDetail.machineLabel', '绑定设备')}</dt>
              <dd className="truncate font-mono text-xs">{detail.usedBy || t('licenseDetail.unbound', '未绑定')}</dd>
            </dl>
            <button
              type="button"
              onClick={() => onCopyCode?.(detail.code)}
              className="inline-flex h-10 items-center rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent"
            >
              {t('licenseDetail.copyCode', '复制激活码')}
            </button>
          </section>

          <section className="space-y-3 rounded-lg border bg-muted/40 p-4">
            <h3 className="text-sm font-semibold text-foreground">{t('licenseDetail.policySection', '换绑策略')}</h3>
            <div className="space-y-1.5">
              <label htmlFor="license-detail-rebind-policy" className="text-xs font-medium text-foreground">
                {t('licenseDetail.policyLabel', '单码自助换绑')}
              </label>
              <select
                id="license-detail-rebind-policy"
                value={policyDraft.policyValue}
                onChange={(event) => onPolicyDraftChange({ policyValue: event.target.value })}
                className={fieldClassName}
              >
                <option value="inherit">{getInheritedRebindPolicyOptionLabel('code')}</option>
                <option value="enabled">{t('licenseDetail.rebindAllowed', '允许自助换绑')}</option>
                <option value="disabled">{t('licenseDetail.rebindForbidden', '禁止自助换绑')}</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="license-detail-rebind-cooldown" className="text-xs font-medium text-foreground">
                  {t('licenseDetail.cooldownLabel', '冷却时间（分钟）')}
                </label>
                <input
                  id="license-detail-rebind-cooldown"
                  type="number"
                  min="0"
                  value={policyDraft.cooldownValue}
                  onChange={(event) => onPolicyDraftChange({ cooldownValue: event.target.value })}
                  className={fieldClassName}
                  placeholder={getInheritedRebindPlaceholder('code', 'cooldown')}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="license-detail-rebind-max-count" className="text-xs font-medium text-foreground">
                  {t('licenseDetail.maxCountLabel', '换绑次数上限')}
                </label>
                <input
                  id="license-detail-rebind-max-count"
                  type="number"
                  min="0"
                  value={policyDraft.maxCountValue}
                  onChange={(event) => onPolicyDraftChange({ maxCountValue: event.target.value })}
                  className={fieldClassName}
                  placeholder={getInheritedRebindPlaceholder('code', 'maxCount')}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="license-detail-reason" className="text-xs font-medium text-foreground">
                {t('licenseDetail.reasonLabel', '操作原因（记入审计，可选）')}
              </label>
              <input
                id="license-detail-reason"
                type="text"
                value={policyDraft.reason}
                onChange={(event) => onPolicyDraftChange({ reason: event.target.value })}
                className={fieldClassName}
                placeholder={t('licenseDetail.reasonPlaceholder', '例如：用户报障换机')}
              />
            </div>
            <button
              type="button"
              onClick={onSavePolicy}
              disabled={!policyDirty || loading}
              className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? t('licenseDetail.saving', '保存中…') : t('licenseDetail.savePolicy', '保存策略')}
            </button>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">{t('licenseDetail.deviceSection', '设备操作')}</h3>
            <div className="space-y-1.5">
              <label htmlFor="license-detail-machine-target" className="text-xs font-medium text-foreground">
                {t('licenseDetail.machineTargetLabel', '目标 machineId')}
              </label>
              <input
                id="license-detail-machine-target"
                type="text"
                value={machineTarget}
                onChange={(event) => onMachineTargetChange(event.target.value)}
                className={`${fieldClassName} font-mono`}
                placeholder={t('licenseDetail.machineTargetPlaceholder', '用于强制换绑')}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onForceUnbind}
                disabled={loading}
                className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent disabled:opacity-50"
              >
                {t('licenseDetail.forceUnbind', '强制解绑')}
              </button>
              <button
                type="button"
                onClick={onForceRebind}
                disabled={loading || !machineTarget.trim()}
                className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent disabled:opacity-50"
              >
                {t('licenseDetail.forceRebind', '强制换绑')}
              </button>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">{t('licenseDetail.historySection', '绑定历史')}</h3>
            {bindingHistories.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('licenseDetail.noHistory', '暂无绑定记录')}</p>
            ) : (
              <ol className="space-y-2 border-l pl-4">
                {bindingHistories.map((entry) => (
                  <li key={entry.id} className="relative text-sm">
                    <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-muted-foreground/50" aria-hidden />
                    <p className="font-medium text-foreground">
                      {getBindingHistoryTitle(entry.eventType, t)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {entry.fromMachineId || t('licenseDetail.unbound', '未绑定')} →{' '}
                      {entry.toMachineId || t('licenseDetail.unbound', '未绑定')}
                      {entry.reason ? ` · ${entry.reason}` : ''}
                    </p>
                    <p className="text-xs tabular-nums text-muted-foreground/80">
                      {new Date(entry.createdAt).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">{t('licenseDetail.auditSection', '管理员操作')}</h3>
            {adminAuditLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('licenseDetail.noAudit', '暂无管理员操作记录')}</p>
            ) : (
              <ol className="space-y-2 border-l pl-4">
                {adminAuditLogs.map((entry) => (
                  <li key={entry.id} className="relative text-sm">
                    <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-muted-foreground/50" aria-hidden />
                    <p className="font-medium text-foreground">
                      {getAdminOperationTypeLabel(entry.operationType)}
                    </p>
                    {entry.reason ? <p className="text-xs text-muted-foreground">{entry.reason}</p> : null}
                    <p className="text-xs text-muted-foreground">
                      {entry.adminUsername} · <span className="tabular-nums">{new Date(entry.createdAt).toLocaleString()}</span>
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="space-y-2 rounded-lg border border-destructive/30 p-4">
            <h3 className="text-sm font-semibold text-foreground">{t('licenseDetail.dangerSection', '危险操作')}</h3>
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex h-10 w-full items-center justify-center rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground shadow-sm transition hover:bg-destructive/90"
            >
              {t('licenseDetail.deleteCode', '删除激活码')}
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}
