import React, { type ButtonHTMLAttributes, type ReactNode } from 'react'

type DashboardInlineActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
}

export function DashboardInlineActionButton({
  children,
  type = 'button',
  className = 'inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50',
  ...props
}: DashboardInlineActionButtonProps) {
  return (
    <button type={type} className={className} {...props}>
      {children}
    </button>
  )
}
