import React, { type ReactNode } from 'react'

type DashboardEmptyStateProps = {
  message: ReactNode
  className?: string
}

export function DashboardEmptyState({
  message,
  className = '',
}: DashboardEmptyStateProps) {
  return (
    <div
      className={`rounded-[24px] border border-dashed border-slate-200 bg-slate-50/75 px-6 py-10 text-center text-sm text-slate-500 ${className}`.trim()}
    >
      {message}
    </div>
  )
}
