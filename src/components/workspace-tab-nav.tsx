import React from 'react'

type WorkspaceTabOption<T extends string> = {
  key: T
  label: string
  shortLabel: string
  description: string
}

type WorkspaceTabNavProps<T extends string> = {
  tabs: WorkspaceTabOption<T>[]
  activeTab: T
  onChange: (tab: T) => void
  badgeTextClassName?: string
}

export function WorkspaceTabNav<T extends string>({
  tabs,
  activeTab,
  onChange,
  badgeTextClassName = 'text-xs',
}: WorkspaceTabNavProps<T>) {
  return (
    <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`rounded-[24px] border p-4 text-left transition ${
              isActive
                ? 'border-sky-200 bg-sky-50/85 shadow-[0_20px_60px_-40px_rgba(2,132,199,0.35)]'
                : 'border-white/70 bg-white/75 hover:-translate-y-0.5 hover:border-slate-200 hover:bg-white/90'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-semibold ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20'
                    : 'bg-slate-900 text-white/90'
                } ${badgeTextClassName}`}
              >
                {tab.shortLabel}
              </div>
              <div className="min-w-0">
                <div className={`text-sm font-semibold ${isActive ? 'text-sky-900' : 'text-slate-900'}`}>
                  {tab.label}
                </div>
                <div className={`mt-1 text-xs leading-6 ${isActive ? 'text-sky-700' : 'text-slate-500'}`}>
                  {tab.description}
                </div>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
