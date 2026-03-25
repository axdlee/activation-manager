import React, { type ReactNode } from 'react'

type DashboardStatusBadgeTone = 'success' | 'neutral' | 'warning' | 'danger' | 'info'

type DashboardStatusBadgeProps = {
  label: ReactNode
  tone?: DashboardStatusBadgeTone
  className?: string
}

const toneClassNameMap: Record<DashboardStatusBadgeTone, string> = {
  success: 'inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700',
  neutral: 'inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700',
  warning: 'inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700',
  danger: 'inline-flex items-center rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-700',
  info: 'inline-flex items-center rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-700',
}

export function DashboardStatusBadge({
  label,
  tone = 'neutral',
  className = toneClassNameMap[tone],
}: DashboardStatusBadgeProps) {
  return <span className={className}>{label}</span>
}
