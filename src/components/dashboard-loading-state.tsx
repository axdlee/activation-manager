import React, { type ReactNode } from 'react'

type DashboardLoadingStateProps = {
  message: ReactNode
  className?: string
}

export function DashboardLoadingState({
  message,
  className = 'py-10 text-center',
}: DashboardLoadingStateProps) {
  return (
    <div className={className}>
      <div className="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
      <p className="mt-2 text-slate-600">{message}</p>
    </div>
  )
}
