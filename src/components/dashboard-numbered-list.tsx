import React, { type ReactNode } from 'react'

type DashboardNumberedListProps = {
  items: ReactNode[]
  className?: string
  itemClassName?: string
  indexClassName?: string
  contentClassName?: string
  renderIndex?: (index: number) => ReactNode
}

const defaultItemClassName =
  'flex items-start gap-3 rounded-[22px] border border-white/80 bg-white/80 px-4 py-4 text-sm leading-7 text-slate-600 shadow-sm'
const defaultIndexClassName =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-xs font-semibold text-white shadow-sm'

function formatDefaultIndex(index: number) {
  return String(index + 1).padStart(2, '0')
}

export function DashboardNumberedList({
  items,
  className = 'space-y-3',
  itemClassName = defaultItemClassName,
  indexClassName = defaultIndexClassName,
  contentClassName,
  renderIndex,
}: DashboardNumberedListProps) {
  return (
    <div className={className}>
      {items.map((item, index) => (
        <div key={`${index}-${String(item)}`} className={itemClassName}>
          <div className={indexClassName}>
            {renderIndex ? renderIndex(index) : formatDefaultIndex(index)}
          </div>
          <div className={contentClassName}>{item}</div>
        </div>
      ))}
    </div>
  )
}
