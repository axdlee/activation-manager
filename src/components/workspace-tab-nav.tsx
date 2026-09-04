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
            className={`rounded-lg border p-4 text-left transition ${
              isActive
                ? 'border-brand-100 bg-brand-50/85 shadow-card'
                : 'border-surface-200 bg-white hover:-translate-y-0.5 hover:border-ink-300 hover:bg-surface-50'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md font-semibold ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-card'
                    : 'bg-slate-900 text-white/90'
                } ${badgeTextClassName}`}
              >
                {tab.shortLabel}
              </div>
              <div className="min-w-0">
                <div className={`text-sm font-semibold ${isActive ? 'text-brand-800' : 'text-ink-900'}`}>
                  {tab.label}
                </div>
                <div className={`mt-1 text-xs leading-6 ${isActive ? 'text-brand-700' : 'text-ink-500'}`}>
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
