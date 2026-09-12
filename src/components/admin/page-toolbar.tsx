'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export type PageToolbarProps = {
  /** 左槽：搜索/筛选类控件 */
  filters?: React.ReactNode
  /** 右槽：刷新/导出/更多动作 */
  actions?: React.ReactNode
  className?: string
}

/**
 * 页面工具栏：左筛选右动作的标准排列。
 * 单行自适应换行；控件高度 ≥ 40px 由调用方控件自身保证。
 */
export function PageToolbar({ filters, actions, className }: PageToolbarProps) {
  const hasContent = Boolean(filters || actions)
  if (!hasContent) {
    return null
  }

  return (
    <div
      role="toolbar"
      aria-orientation="horizontal"
      className={cn('flex flex-wrap items-center justify-between gap-2', className)}
    >
      {filters ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2">{filters}</div>
      ) : (
        <div aria-hidden className="flex-1" />
      )}
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}
