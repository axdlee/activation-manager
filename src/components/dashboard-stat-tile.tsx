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
  className = 'rounded-[22px] border border-white/80 bg-white/80 px-4 py-4 shadow-sm',
  labelClassName = 'text-xs uppercase tracking-[0.18em] text-slate-500',
  valueClassName = 'mt-2 text-2xl font-semibold tracking-tight text-slate-900',
  descriptionClassName = 'mt-1 text-sm text-slate-500',
}: DashboardStatTileProps) {
  return (
    <div className={className}>
      <div className={labelClassName}>{label}</div>
      <div className={valueClassName}>{value}</div>
      <div className={descriptionClassName}>{description}</div>
    </div>
  )
}
