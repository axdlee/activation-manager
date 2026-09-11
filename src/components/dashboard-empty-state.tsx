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
      className={`rounded-lg border border-dashed border-border bg-muted/75 px-6 py-10 text-center text-sm text-muted-foreground ${className}`.trim()}
    >
      {message}
    </div>
  )
}
