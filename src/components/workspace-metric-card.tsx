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
  className = 'rounded-[22px] border border-white/80 bg-white/80 px-4 py-4 shadow-sm',
}: WorkspaceMetricCardProps) {
  return (
    <div className={className}>
      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{description}</div>
    </div>
  )
}
