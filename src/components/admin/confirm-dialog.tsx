'use client'

import * as React from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type ConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 操作名，如“删除项目” */
  title: React.ReactNode
  /** 影响说明：目标对象 + 不可逆性 */
  description?: React.ReactNode
  /** 目标对象名，加粗展示（如项目名/激活码） */
  targetLabel?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel?: () => void
  children?: ReactNode
}

/**
 * 危险/不可逆操作确认对话框。
 * loading 时锁定按钮；Escape/取消/遮罩均触发 onOpenChange(false)。
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  targetLabel,
  confirmLabel = '确认',
  cancelLabel = '取消',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  const handleCancel = () => {
    onCancel?.()
    onOpenChange(false)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <button type="button" aria-label="取消确认" onClick={handleCancel} className="absolute inset-0 bg-black/50" />
      <div
        className={cn(
          'relative z-10 w-full max-w-md rounded-lg border bg-card p-5 shadow-lg animate-in fade-in zoom-in-95 duration-150',
        )}
      >
        <h2 id="confirm-title" className="text-base font-semibold text-foreground">
          {title}
        </h2>
        {targetLabel ? (
          <p className="mt-2 text-sm text-foreground">
            <span className="font-medium">{targetLabel}</span>
          </p>
        ) : null}
        {description ? <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{description}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleCancel}
            disabled={loading}
            className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium shadow transition-colors disabled:cursor-not-allowed disabled:opacity-50',
              destructive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : 'bg-primary text-primary-foreground hover:bg-primary/90',
            )}
          >
            {loading ? '处理中…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
