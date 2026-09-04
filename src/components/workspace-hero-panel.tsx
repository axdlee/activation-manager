import React, { type ReactNode } from 'react'

type WorkspaceHeroPanelProps = {
  badge: string
  title: string
  description: string
  metrics: ReactNode
  tabs: ReactNode
  gradientClassName: string
}

export function WorkspaceHeroPanel({
  badge,
  title,
  description,
  metrics,
  tabs,
  gradientClassName,
}: WorkspaceHeroPanelProps) {
  return (
    <div className="relative overflow-hidden p-6 sm:p-7">
      <div className={`absolute inset-0 ${gradientClassName}`} />
      <div className="relative">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-surface-100 px-3 py-1 text-[11px] font-semibold tracking-[0.22em] text-brand-400 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-brand-500/100/100" />
              {badge}
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-ink-50">{title}</h2>
            <p className="mt-2 text-sm leading-7 text-ink-500 sm:text-base">{description}</p>
          </div>

          {metrics}
        </div>

        {tabs}
      </div>
    </div>
  )
}
