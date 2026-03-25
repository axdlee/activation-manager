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
}

export function DashboardDataTable({
  headers,
  children,
  containerClassName,
  tableClassName = 'min-w-full divide-y divide-gray-200',
  headClassName = 'bg-slate-50/90',
  bodyClassName = 'divide-y divide-gray-200 bg-white',
  headerCellClassName = 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider',
}: DashboardDataTableProps) {
  return (
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
  )
}
