import React, { type ReactNode } from 'react'

type DashboardTableContainerProps = {
  children: ReactNode
  className?: string
}

export function DashboardTableContainer({
  children,
  className = 'overflow-x-auto rounded-[24px] border border-slate-200/80 bg-white/95 shadow-[0_18px_56px_-42px_rgba(15,23,42,0.22)]',
}: DashboardTableContainerProps) {
  return <div className={className}>{children}</div>
}
