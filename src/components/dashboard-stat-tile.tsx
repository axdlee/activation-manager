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
  className = 'rounded-lg border border-border bg-card px-4 py-4 shadow-card',
  labelClassName = 'text-xs uppercase tracking-[0.18em] text-muted-foreground',
  valueClassName = 'mt-2 text-2xl font-semibold tracking-tight text-foreground',
  descriptionClassName = 'mt-1 text-sm text-muted-foreground',
}: DashboardStatTileProps) {
  return (
    <div className={className}>
      <div className={labelClassName}>{label}</div>
      <div className={valueClassName}>{value}</div>
      <div className={descriptionClassName}>{description}</div>
    </div>
  )
}
