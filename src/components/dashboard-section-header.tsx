import React, { type ReactNode } from 'react'

type DashboardSectionHeaderProps = {
  title: ReactNode
  description: ReactNode
  trailing?: ReactNode
  className?: string
}

export function DashboardSectionHeader({
  title,
  description,
  trailing,
  className = 'mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between',
}: DashboardSectionHeaderProps) {
  return (
    <div className={className}>
      <div>
        <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      </div>
      {trailing ? <div>{trailing}</div> : null}
    </div>
  )
}
