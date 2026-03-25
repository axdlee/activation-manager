import React, { type ButtonHTMLAttributes, type ReactNode } from 'react'

type DashboardSubmitFieldProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'className' | 'type'
> & {
  idleText: ReactNode
  loadingText: ReactNode
  loading?: boolean
  buttonClassName: string
  className?: string
  type?: 'submit' | 'button' | 'reset'
  buttonWidthClassName?: string
}

export function DashboardSubmitField({
  idleText,
  loadingText,
  buttonClassName,
  loading = false,
  disabled = false,
  className = 'flex items-end',
  type = 'submit',
  buttonWidthClassName = 'w-full',
  ...props
}: DashboardSubmitFieldProps) {
  return (
    <div className={className}>
      <button
        type={type}
        disabled={loading || disabled}
        className={`${buttonWidthClassName} ${buttonClassName}`.trim()}
        {...props}
      >
        {loading ? loadingText : idleText}
      </button>
    </div>
  )
}
