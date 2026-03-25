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
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-white/80 px-3 py-1 text-[11px] font-semibold tracking-[0.22em] text-sky-700 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-sky-500" />
              {badge}
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">{title}</h2>
            <p className="mt-2 text-sm leading-7 text-slate-500 sm:text-base">{description}</p>
          </div>

          {metrics}
        </div>

        {tabs}
      </div>
    </div>
  )
}
