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
                ? 'border-primary/25 bg-primary/10 shadow-card'
                : 'border-border bg-card hover:-translate-y-0.5 hover:border-border hover:bg-muted/50'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md font-semibold ${
                  isActive
                    ? 'bg-primary text-white shadow-card'
                    : 'bg-ink-900 text-white/90'
                } ${badgeTextClassName}`}
              >
                {tab.shortLabel}
              </div>
              <div className="min-w-0">
                <div className={`text-sm font-semibold ${isActive ? 'text-primary' : 'text-foreground'}`}>
                  {tab.label}
                </div>
                <div className={`mt-1 text-xs leading-6 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
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
