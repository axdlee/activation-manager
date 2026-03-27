'use client'

import React, { type ReactNode, useEffect, useId } from 'react'

type DashboardModalSize = 'md' | 'lg' | 'xl' | '4xl' | '6xl'

type DashboardModalProps = {
  open: boolean
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  onClose: () => void
  size?: DashboardModalSize
  panelClassName?: string
  bodyClassName?: string
}

const sizeClassNameMap: Record<DashboardModalSize, string> = {
  md: 'max-w-2xl',
  lg: 'max-w-3xl',
  xl: 'max-w-4xl',
  '4xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
}

export function DashboardModal({
  open,
  title,
  description,
  children,
  footer,
  onClose,
  size = 'xl',
  panelClassName =
    'rounded-[30px] border border-slate-200 bg-white shadow-[0_38px_120px_-52px_rgba(15,23,42,0.38)]',
  bodyClassName = 'max-h-[calc(100vh-14rem)] overflow-y-auto px-6 py-6 sm:px-7',
}: DashboardModalProps) {
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (!open) {
      return
    }

    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  if (!open) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
    >
      <button
        type="button"
        aria-label="关闭弹框"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/30 backdrop-blur-sm"
      />

      <div className={`relative z-10 w-full ${sizeClassNameMap[size]} ${panelClassName}`}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-200/80 px-6 py-5 sm:px-7">
          <div className="min-w-0">
            <h3 id={titleId} className="text-xl font-semibold tracking-tight text-slate-900">
              {title}
            </h3>
            {description ? (
              <p id={descriptionId} className="mt-2 text-sm leading-6 text-slate-500">
                {description}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-lg text-slate-500 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:text-slate-700"
          >
            ×
          </button>
        </div>

        <div className={bodyClassName}>{children}</div>

        {footer ? <div className="border-t border-slate-200 bg-slate-50/80 px-6 py-5 sm:px-7">{footer}</div> : null}
      </div>
    </div>
  )
}
