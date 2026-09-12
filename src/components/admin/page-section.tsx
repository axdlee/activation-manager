'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export type PageSectionProps = {
  title?: React.ReactNode
  description?: React.ReactNode
  /** 标题右侧的动作（如“新建”“导出”） */
  actions?: React.ReactNode
  /** 无 Card 基底时用 plain（纯排版分区） */
  variant?: 'card' | 'plain'
  /** 内容区去掉内边距（表格贴边场景） */
  flush?: boolean
  children: React.ReactNode
  className?: string
}

/**
 * 统一页面分区：标题/描述/动作 + 内容。
 * card 变体带 Card 表面；plain 变体只做排版分隔。
 */
export function PageSection({
  title,
  description,
  actions,
  variant = 'card',
  flush = false,
  children,
  className,
}: PageSectionProps) {
  if (variant === 'plain') {
    return (
      <section className={cn('py-5 first:pt-0', className)}>
        {title || actions ? (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              {title ? <h2 className="text-base font-semibold text-foreground">{title}</h2> : null}
              {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
            </div>
            {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
          </div>
        ) : null}
        {children}
      </section>
    )
  }

  return (
    <section className={cn('rounded-lg border bg-card text-card-foreground shadow-sm', className)}>
      {title || actions ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4">
          <div className="min-w-0">
            {title ? <h2 className="text-base font-semibold text-foreground">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cn(flush ? '' : 'p-5', className && '')}>{children}</div>
    </section>
  )
}
