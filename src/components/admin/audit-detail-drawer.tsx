'use client'

import * as React from 'react'
import { X } from 'lucide-react'

import { buildAdminOperationDetailSummary } from '@/lib/admin-audit-log-ui'
import type { AuditPageLog } from '@/components/admin/audit-page'
import { useI18n } from '@/lib/i18n/i18n-provider'

export type AuditDetailDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  log: AuditPageLog | null
  getOperationTypeLabel: (operationType: string) => string
}

/** 审计详情 Drawer：操作概要 + 可读时间线描述（不倾倒裸 JSON）。 */
export function AuditDetailDrawer({
  open,
  onOpenChange,
  log,
  getOperationTypeLabel,
}: AuditDetailDrawerProps) {
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

  if (!open || !log) return null

  const detailSummary = buildAdminOperationDetailSummary(log.operationType, log.detailJson, (key, fallback) =>
    t(key, fallback ?? key),
  )
  const timeline = [
    {
      id: 'created',
      title: t('auditDetail.operationCreated', '操作发生'),
      description: `${log.adminUsername}${log.reason ? ` · ${log.reason}` : ''}${
        detailSummary ? ` · ${detailSummary}` : ''
      }`,
      timestamp: new Date(log.createdAt).toLocaleString(),
    },
  ]

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button
        type="button"
        aria-label={t('auditDetail.close', '关闭详情')}
        onClick={() => onOpenChange(false)}
        className="absolute inset-0 bg-black/50"
      />
      <div
        className="absolute inset-y-0 right-0 flex w-full flex-col border-l bg-card shadow-lg animate-in slide-in-from-right duration-200"
        style={{ maxWidth: 480 }}
      >
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-base font-semibold text-foreground">
              {getOperationTypeLabel(log.operationType)}
            </h2>
            {log.targetLabel ? (
              <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{log.targetLabel}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label={t('auditDetail.close', '关闭详情')}
            className="shrink-0 rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">{t('auditDetail.summarySection', '操作概要')}</h3>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">{t('auditDetail.adminLabel', '管理员')}</dt>
              <dd>{log.adminUsername}</dd>
              <dt className="text-muted-foreground">{t('auditDetail.targetLabel', '目标')}</dt>
              <dd className="truncate font-mono text-xs">{log.targetLabel || '—'}</dd>
              <dt className="text-muted-foreground">{t('auditDetail.reasonLabel', '原因')}</dt>
              <dd>{log.reason || '—'}</dd>
            </dl>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">{t('auditDetail.timelineSection', '时间线')}</h3>
            <ol className="space-y-3 border-l pl-4">
              {timeline.map((entry) => (
                <li key={entry.id} className="relative text-sm">
                  <span
                    className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-muted-foreground/50"
                    aria-hidden
                  />
                  <p className="font-medium text-foreground">{entry.title}</p>
                  <p className="break-words text-xs leading-5 text-muted-foreground">{entry.description}</p>
                  <p className="text-xs tabular-nums text-muted-foreground/80">{entry.timestamp}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  )
}
