'use client'

import * as React from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type Crumb = { label: string; href?: string }

export type PageHeaderProps = {
  /** 面包屑（不含当前页） */
  breadcrumbs?: Crumb[]
  /** 眉题（小字标签，如分组名） */
  eyebrow?: string
  /** 页面标题（每页唯一 h1） */
  title: string
  /** 一句话描述，紧跟标题同行/下方 */
  description?: string
  /** 主动作 + 次动作槽位 */
  actions?: React.ReactNode
  className?: string
}

/**
 * 紧凑页头：标题 + 描述一行铺开，右侧行动区。每页仅一个 h1。
 * 替代旧的巨型 Hero（徽章 + 大标题 + 描述 + 重复提示框）。
 */
export function PageHeader({ breadcrumbs, eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('mb-5', className)}>
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav aria-label="Breadcrumb" className="mb-1.5 flex items-center gap-1 text-xs text-muted-foreground">
          {breadcrumbs.map((crumb, index) => (
            <span key={index} className="flex items-center gap-1">
              {index > 0 && <ChevronRight className="h-3 w-3" aria-hidden />}
              {crumb.href ? (
                <Link href={crumb.href} className="transition-colors hover:text-foreground">
                  {crumb.label}
                </Link>
              ) : (
                <span>{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
          {eyebrow ? (
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              {eyebrow}
            </span>
          ) : null}
          <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">{title}</h1>
          {description ? <span className="text-sm text-muted-foreground">{description}</span> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  )
}
