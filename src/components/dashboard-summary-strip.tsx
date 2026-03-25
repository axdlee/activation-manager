import React, { type ReactNode } from 'react'

type DashboardSummaryStripProps = {
  leading: ReactNode
  trailing?: ReactNode
  className?: string
  contentClassName?: string
}

export function DashboardSummaryStrip({
  leading,
  trailing,
  className = 'mb-5 rounded-[24px] border border-slate-200/80 bg-slate-50/85 px-5 py-4',
  contentClassName = 'flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between',
}: DashboardSummaryStripProps) {
  return (
    <div className={className}>
      <div className={contentClassName}>
        <div>{leading}</div>
        {trailing ? <div>{trailing}</div> : null}
      </div>
    </div>
  )
}
