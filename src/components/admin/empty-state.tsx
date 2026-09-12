'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export type EmptyStateProps = {
  icon?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  /** 明确的下一步动作（如“新建项目”） */
  action?: React.ReactNode
  className?: string
}

/** 空态：说明为什么为空 + 下一步该做什么。 */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-12 text-center',
        className,
      )}
    >
      {icon ? <div className="text-muted-foreground/60">{icon}</div> : null}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}
