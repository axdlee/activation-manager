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
  tableClassName = 'w-full min-w-max divide-y divide-gray-200',
  headClassName = 'bg-slate-50/90',
  bodyClassName = 'divide-y divide-gray-200 bg-white',
  headerCellClassName = 'whitespace-nowrap px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider',
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
      <div className="flex flex-wrap items-center gap-2 px-1 text-xs text-slate-400">
        <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1">
          ↔ 宽表格提示
        </span>
        <span>{scrollHintText}</span>
      </div>
    </div>
  )
}
