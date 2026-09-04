import React, { type ReactNode } from 'react'

type DashboardActionPanelProps = {
  badge: ReactNode
  title: ReactNode
  description: ReactNode
  action: ReactNode
  children?: ReactNode
  background?: ReactNode
  className?: string
  innerClassName?: string
  contentClassName?: string
  badgeClassName?: string
  titleClassName?: string
  descriptionClassName?: string
}

export function DashboardActionPanel({
  badge,
  title,
  description,
  action,
  children,
  background,
  className = 'rounded-lg border border-ink-950/10 bg-ink-950/95 p-5 text-white shadow-card',
  innerClassName = 'flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between',
  contentClassName,
  badgeClassName = 'inline-flex items-center rounded-full border border-surface-200 bg-surface-100 px-3 py-1 text-[11px] font-semibold tracking-[0.22em] text-ink-700',
  titleClassName = 'mt-3 text-base font-semibold text-white',
  descriptionClassName = 'mt-1 text-sm leading-6 text-ink-300',
}: DashboardActionPanelProps) {
  return (
    <div className={className}>
      {background}
      <div className={innerClassName}>
        <div className={contentClassName}>
          <div className={badgeClassName}>{badge}</div>
          <h3 className={titleClassName}>{title}</h3>
          <p className={descriptionClassName}>{description}</p>
          {children}
        </div>
        {action}
      </div>
    </div>
  )
}
