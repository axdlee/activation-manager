'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export type DetailDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  /** 默认 480px；小屏自动全宽 */
  width?: number
  className?: string
}

/**
 * 详情抽屉：行点击后在右侧滑出。
 * - 打开时记录触发元素，关闭后恢复焦点
 * - Escape/遮罩关闭由内部处理
 * - 语义：role=dialog + aria-labelledby
 */
export function DetailDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = 480,
  className,
}: DetailDrawerProps) {
  const titleId = React.useId()
  const descriptionId = React.useId()
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

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}>
      <button
        type="button"
        aria-label="关闭详情"
        onClick={() => onOpenChange(false)}
        className="absolute inset-0 bg-black/50"
      />
      <div
        className={cn(
          'absolute inset-y-0 right-0 flex w-full flex-col border-l bg-card shadow-lg animate-in slide-in-from-right duration-200',
          className,
        )}
        style={{ maxWidth: width }}
      >
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-foreground">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-sm text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="关闭详情"
            className="shrink-0 rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="border-t px-5 py-3">{footer}</div> : null}
      </div>
    </div>
  )
}
