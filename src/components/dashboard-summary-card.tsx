import React, { type ReactNode } from 'react'

type DashboardSummaryCardProps = {
  label: ReactNode
  value: ReactNode
  description: ReactNode
  className?: string
  panelClassName?: string
  accentClassName?: string
  labelClassName?: string
  valueClassName?: string
  descriptionClassName?: string
}

const baseClassName =
  'relative overflow-hidden rounded-lg border px-5 py-5 shadow-card'

export function DashboardSummaryCard({
  label,
  value,
  description,
  className,
  panelClassName,
  accentClassName = 'bg-ink-900',
  labelClassName = 'text-xs uppercase tracking-[0.18em] text-ink-500',
  valueClassName = 'mt-3 text-3xl font-semibold tracking-tight text-ink-50',
  descriptionClassName = 'mt-2 text-sm leading-6 text-ink-500',
}: DashboardSummaryCardProps) {
  const containerClassName = [baseClassName, panelClassName, className].filter(Boolean).join(' ')

  return (
    <div className={containerClassName}>
      <div className={`absolute inset-x-5 top-0 h-1 rounded-full ${accentClassName}`.trim()} />
      <div className={labelClassName}>{label}</div>
      <div className={valueClassName}>{value}</div>
      <div className={descriptionClassName}>{description}</div>
    </div>
  )
}
