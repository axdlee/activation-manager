import React, { forwardRef } from 'react'

export type AppTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  className?: string
}

export const AppTextarea = forwardRef<HTMLTextAreaElement, AppTextareaProps>(function AppTextarea(
  { className, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={`w-full rounded-md border border-surface-300 bg-surface-800 px-3.5 py-2.5 text-sm text-ink-50 shadow-sm outline-none transition placeholder:text-ink-500 focus:border-brand-500/50 focus:ring-4 focus:ring-brand-500/10 disabled:bg-surface-50 disabled:text-ink-300 ${className ?? ''}`}
      {...props}
    />
  )
})
