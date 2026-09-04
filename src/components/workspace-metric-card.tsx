import React from 'react'

type WorkspaceMetricCardProps = {
  label: string
  value: React.ReactNode
  description: string
  className?: string
}

export function WorkspaceMetricCard({
  label,
  value,
  description,
  className = 'rounded-lg border border-surface-200 bg-surface-100 px-4 py-4 shadow-card',
}: WorkspaceMetricCardProps) {
  return (
    <div className={className}>
      <div className="text-xs uppercase tracking-[0.18em] text-ink-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-ink-50">{value}</div>
      <div className="mt-1 text-sm text-ink-500">{description}</div>
    </div>
  )
}
