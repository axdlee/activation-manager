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
      className={`rounded-lg border border-dashed border-surface-200 bg-surface-50/75 px-6 py-10 text-center text-sm text-ink-500 ${className}`.trim()}
    >
      {message}
    </div>
  )
}
