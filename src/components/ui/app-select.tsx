import React, { forwardRef } from 'react'

export type AppSelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  className?: string
}

export const AppSelect = forwardRef<HTMLSelectElement, AppSelectProps>(function AppSelect(
  { className, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={`w-full appearance-none rounded-md border border-surface-300 bg-surface-800 px-3.5 py-2.5 pr-9 text-sm text-ink-50 shadow-sm outline-none transition placeholder:text-ink-500 focus:border-brand-500/50 focus:ring-4 focus:ring-brand-500/10 disabled:bg-surface-50 disabled:text-ink-300 ${className ?? ''}`}
        {...props}
      >
        {children}
      </select>
      <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-ink-500">
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </div>
  )
})
