import React, { forwardRef } from 'react'

import { inputClassName } from '@/lib/dashboard-class-names'

export type AppInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  leadingIcon?: React.ReactNode
  trailingIcon?: React.ReactNode
}

export const AppInput = forwardRef<HTMLInputElement, AppInputProps>(function AppInput(
  { className, leadingIcon, trailingIcon, ...props },
  ref,
) {
  if (!leadingIcon && !trailingIcon) {
    return <input ref={ref} className={`${inputClassName} ${className ?? ''}`} {...props} />
  }

  return (
    <div className="relative">
      {leadingIcon ? (
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-ink-500">
          {leadingIcon}
        </span>
      ) : null}
      <input
        ref={ref}
        className={`${inputClassName} ${leadingIcon ? 'pl-10' : ''} ${trailingIcon ? 'pr-10' : ''} ${
          className ?? ''
        }`}
        {...props}
      />
      {trailingIcon ? (
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-ink-500">
          {trailingIcon}
        </span>
      ) : null}
    </div>
  )
})
