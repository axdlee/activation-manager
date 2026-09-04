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
  className = 'rounded-lg border border-surface-200 bg-white p-5 shadow-sm',
  bodyClassName = 'mt-4',
}: DashboardFilterFieldCardProps) {
  return (
    <div className={className}>
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-sm font-semibold text-ink-900">
          {label}
        </label>
      ) : (
        <div className="text-sm font-semibold text-ink-900">{label}</div>
      )}
      <p className="mt-2 text-sm leading-6 text-ink-500">{description}</p>
      <div className={bodyClassName}>{children}</div>
    </div>
  )
}
