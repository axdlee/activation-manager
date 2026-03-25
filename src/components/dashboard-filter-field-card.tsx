import React, { type ReactNode } from 'react'

type DashboardFilterFieldCardProps = {
  label: ReactNode
  description: ReactNode
  children: ReactNode
  htmlFor?: string
  className?: string
  bodyClassName?: string
}

export function DashboardFilterFieldCard({
  label,
  description,
  children,
  htmlFor,
  className = 'rounded-[24px] border border-slate-200/80 bg-white/88 p-5 shadow-[0_18px_56px_-42px_rgba(15,23,42,0.28)]',
  bodyClassName = 'mt-4',
}: DashboardFilterFieldCardProps) {
  return (
    <div className={className}>
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-sm font-semibold text-slate-900">
          {label}
        </label>
      ) : (
        <div className="text-sm font-semibold text-slate-900">{label}</div>
      )}
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      <div className={bodyClassName}>{children}</div>
    </div>
  )
}
