import React, { type ReactNode } from 'react'

type DashboardCodePanelProps = {
  header: ReactNode
  code: ReactNode
  action?: ReactNode
  className?: string
  panelClassName?: string
  headerClassName?: string
  headerContentClassName?: string
  codeClassName?: string
}

const defaultPanelClassName =
  'rounded-lg border border-border bg-card p-5 shadow-card'
const defaultHeaderClassName =
  'mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'
const defaultCodeClassName =
  'overflow-x-auto rounded-md border border-input bg-zinc-950 px-4 py-4 font-mono text-xs leading-6 text-zinc-100 shadow-card'

export function DashboardCodePanel({
  header,
  code,
  action,
  className,
  panelClassName = defaultPanelClassName,
  headerClassName = defaultHeaderClassName,
  headerContentClassName,
  codeClassName = defaultCodeClassName,
}: DashboardCodePanelProps) {
  return (
    <div className={[panelClassName, className].filter(Boolean).join(' ')}>
      <div className={headerClassName}>
        <div className={headerContentClassName}>{header}</div>
        {action}
      </div>
      <pre className={codeClassName}>
        <code>{code}</code>
      </pre>
    </div>
  )
}
