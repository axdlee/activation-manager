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
  className = 'rounded-lg border border-border bg-card px-4 py-4 shadow-card',
}: WorkspaceMetricCardProps) {
  return (
    <div className={className}>
      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</div>
      <div className="mt-1 text-sm text-muted-foreground">{description}</div>
    </div>
  )
}
