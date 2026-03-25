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
  'rounded-[24px] border border-slate-200/80 bg-white/92 p-5 shadow-[0_18px_56px_-42px_rgba(15,23,42,0.22)]'
const defaultHeaderClassName =
  'mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'
const defaultCodeClassName =
  'overflow-x-auto rounded-[22px] border border-slate-200/80 bg-slate-950 px-4 py-4 font-mono text-[12px] leading-6 text-slate-100 shadow-[0_18px_56px_-42px_rgba(15,23,42,0.55)]'

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
