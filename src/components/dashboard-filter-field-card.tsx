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
  className = 'rounded-lg border border-border bg-card p-5 shadow-sm',
  bodyClassName = 'mt-4',
}: DashboardFilterFieldCardProps) {
  return (
    <div className={className}>
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-sm font-semibold text-foreground">
          {label}
        </label>
      ) : (
        <div className="text-sm font-semibold text-foreground">{label}</div>
      )}
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      <div className={bodyClassName}>{children}</div>
    </div>
  )
}
