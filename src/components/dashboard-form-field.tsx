import React, { type ReactNode } from 'react'

type DashboardFormFieldProps = {
  label: ReactNode
  children: ReactNode
  description?: ReactNode
  htmlFor?: string
  className?: string
  labelClassName?: string
  descriptionClassName?: string
  bodyClassName?: string
}

export function DashboardFormField({
  label,
  children,
  description,
  htmlFor,
  className,
  labelClassName = 'mb-2 block text-sm font-medium text-slate-700',
  descriptionClassName = 'mt-1 text-sm leading-6 text-slate-500',
  bodyClassName,
}: DashboardFormFieldProps) {
  return (
    <div className={className}>
      {htmlFor ? (
        <label htmlFor={htmlFor} className={labelClassName}>
          {label}
        </label>
      ) : (
        <div className={labelClassName}>{label}</div>
      )}
      {description ? <p className={descriptionClassName}>{description}</p> : null}
      <div className={bodyClassName}>{children}</div>
    </div>
  )
}
