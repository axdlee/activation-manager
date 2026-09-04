import React, { type ReactNode } from 'react'

type DashboardStatTileProps = {
  label: ReactNode
  value: ReactNode
  description: ReactNode
  className?: string
  labelClassName?: string
  valueClassName?: string
  descriptionClassName?: string
}

export function DashboardStatTile({
  label,
  value,
  description,
  className = 'rounded-lg border border-surface-200 bg-surface-100 px-4 py-4 shadow-card',
  labelClassName = 'text-xs uppercase tracking-[0.18em] text-ink-500',
  valueClassName = 'mt-2 text-2xl font-semibold tracking-tight text-ink-50',
  descriptionClassName = 'mt-1 text-sm text-ink-500',
}: DashboardStatTileProps) {
  return (
    <div className={className}>
      <div className={labelClassName}>{label}</div>
      <div className={valueClassName}>{value}</div>
      <div className={descriptionClassName}>{description}</div>
    </div>
  )
}
