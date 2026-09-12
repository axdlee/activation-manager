'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export type StickySaveBarProps = {
  /** 未保存的变更项数量 */
  dirtyCount: number
  saving?: boolean
  onReset: () => void
  onSave: () => void
  /** 自定义未保存文案（默认“X 项未保存”） */
  dirtyLabel?: string
  className?: string
}

/**
 * 设置/复杂表单的固定保存栏：显示未保存数量、重置与保存。
 * dirtyCount 为 0 时隐藏（调用方条件渲染亦可）。
 */
export function StickySaveBar({ dirtyCount, saving = false, onReset, onSave, dirtyLabel, className }: StickySaveBarProps) {
  if (dirtyCount <= 0 && !saving) return null

  return (
    <div
      className={cn(
        'sticky bottom-0 z-30 -mx-5 mt-4 flex flex-wrap items-center justify-between gap-3 border-t bg-card/95 px-5 py-3 backdrop-blur',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <span className="text-sm text-muted-foreground">
        {saving ? '正在保存…' : (dirtyLabel ?? `${dirtyCount} 项未保存`)}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onReset}
          disabled={saving}
          className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          重置
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? '保存中…' : '保存更改'}
        </button>
      </div>
    </div>
  )
}
