'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export type ErrorStateProps = {
  title?: React.ReactNode
  /** 可读错误信息 */
  message: React.ReactNode
  /** 重试动作（可选；由调用方执行） */
  retry?: () => void
  retryLabel?: string
  className?: string
}

/**
 * 错误态：可读错误 + 重试。调用方负责保留已有数据，本组件只做展示。
 */
export function ErrorState({ title = '加载失败', message, retry, retryLabel = '重试', className }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-10 text-center',
        className,
      )}
    >
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      {retry ? (
        <button
          type="button"
          onClick={retry}
          className="mt-2 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  )
}
