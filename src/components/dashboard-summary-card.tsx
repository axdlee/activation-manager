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
  'relative overflow-hidden rounded-[24px] border px-5 py-5 shadow-[0_18px_56px_-42px_rgba(15,23,42,0.3)]'

export function DashboardSummaryCard({
  label,
  value,
  description,
  className,
  panelClassName,
  accentClassName = 'bg-slate-900',
  labelClassName = 'text-xs uppercase tracking-[0.18em] text-slate-500',
  valueClassName = 'mt-3 text-3xl font-semibold tracking-tight text-slate-900',
  descriptionClassName = 'mt-2 text-sm leading-6 text-slate-500',
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
