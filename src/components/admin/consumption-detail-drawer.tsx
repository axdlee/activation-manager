'use client'

import * as React from 'react'
import { X } from 'lucide-react'

import type { LicenseConsumptionLog } from '@/lib/use-consumption-logs'
import { useI18n } from '@/lib/i18n/i18n-provider'

export type ConsumptionDetailDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  log: LicenseConsumptionLog | null
  onCopyText?: (text: string) => void
}

/** 消费日志详情 Drawer：请求/设备/激活码/剩余次数一次看全，支持复制排障字段。 */
export function ConsumptionDetailDrawer({
  open,
  onOpenChange,
  log,
  onCopyText,
}: ConsumptionDetailDrawerProps) {
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

  const copyableFields: Array<{ label: string; value: string }> = [
    { label: t('consumptionDetail.requestId', 'requestId'), value: log.requestId },
    { label: t('consumptionDetail.machineId', 'machineId'), value: log.machineId },
  ]

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button
        type="button"
        aria-label={t('consumptionDetail.close', '关闭详情')}
        onClick={() => onOpenChange(false)}
        className="absolute inset-0 bg-black/50"
      />
      <div
        className="absolute inset-y-0 right-0 flex w-full flex-col border-l bg-card shadow-lg animate-in slide-in-from-right duration-200"
        style={{ maxWidth: 480 }}
      >
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate font-mono text-base font-semibold text-foreground">
              {log.activationCode.code}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {log.activationCode.project?.name || '—'} · {new Date(log.createdAt).toLocaleString()}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label={t('consumptionDetail.close', '关闭详情')}
            className="shrink-0 rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">{t('consumptionDetail.summarySection', '本次消耗')}</h3>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">{t('consumptionDetail.remainingAfter', '剩余次数')}</dt>
              <dd className="tabular-nums">
                {log.remainingCountAfter} / {log.activationCode.totalCount ?? '—'}
              </dd>
              <dt className="text-muted-foreground">{t('consumptionDetail.modeLabel', '授权类型')}</dt>
              <dd>{log.activationCode.licenseMode === 'TIME' ? t('consumptionDetail.modeTime', '时间型') : t('consumptionDetail.modeCount', '次数型')}</dd>
              <dt className="text-muted-foreground">{t('consumptionDetail.project', '项目')}</dt>
              <dd>
                {log.activationCode.project?.name || '—'}
                {log.activationCode.project?.projectKey ? (
                  <span className="ml-1 font-mono text-xs text-muted-foreground">
                    {log.activationCode.project.projectKey}
                  </span>
                ) : null}
              </dd>
            </dl>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">{t('consumptionDetail.traceSection', '排障字段')}</h3>
            {copyableFields.map((field) => (
              <div key={field.label} className="flex items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{field.label}</p>
                  <p className="truncate font-mono text-sm text-foreground">{field.value}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onCopyText?.(field.value)}
                  className="inline-flex h-10 shrink-0 items-center rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent"
                >
                  {t('consumptionDetail.copy', '复制')}
                </button>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  )
}
