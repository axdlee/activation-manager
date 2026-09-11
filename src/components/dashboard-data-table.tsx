import React, { type ReactNode } from 'react'

import { DashboardTableContainer } from '@/components/dashboard-table-container'

type DashboardDataTableProps = {
  headers: string[]
  children: ReactNode
  containerClassName?: string
  tableClassName?: string
  headClassName?: string
  bodyClassName?: string
  headerCellClassName?: string
  scrollHintText?: string
}

export function DashboardDataTable({
  headers,
  children,
  containerClassName,
  tableClassName = 'w-full min-w-max divide-y divide-surface-200',
  headClassName = 'bg-muted/50',
  bodyClassName = 'divide-y divide-surface-200 bg-card',
  headerCellClassName = 'whitespace-nowrap px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider',
  scrollHintText = '列较多时可左右拖动、Shift + 滚轮或拖动滚动条查看完整内容',
}: DashboardDataTableProps) {
  return (
    <div className="space-y-2">
      <DashboardTableContainer className={containerClassName}>
        <table className={tableClassName}>
          <thead className={headClassName}>
            <tr>
              {headers.map((header) => (
                <th key={header} className={headerCellClassName}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={bodyClassName}>{children}</tbody>
        </table>
      </DashboardTableContainer>
      <div className="flex flex-wrap items-center gap-2 px-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1">
          ↔ 宽表格提示
        </span>
        <span>{scrollHintText}</span>
      </div>
    </div>
  )
}
