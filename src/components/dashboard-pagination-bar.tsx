import React, { type ReactNode } from 'react'

type DashboardPaginationBarProps = {
  currentPage: number
  totalPages: number
  summary: ReactNode
  onPageChange: (page: number) => void
  buttonClassName: string
  activeButtonClassName: string
  className?: string
}

export function DashboardPaginationBar({
  currentPage,
  totalPages,
  summary,
  onPageChange,
  buttonClassName,
  activeButtonClassName,
  className = 'mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between',
}: DashboardPaginationBarProps) {
  if (totalPages <= 1) {
    return null
  }

  return (
    <div className={className}>
      <div className="text-sm text-gray-700">{summary}</div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={buttonClassName}
        >
          上一页
        </button>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`${buttonClassName} ${currentPage === page ? activeButtonClassName : ''}`.trim()}
            >
              {page}
            </button>
          ))}
        </div>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={buttonClassName}
        >
          下一页
        </button>
      </div>
    </div>
  )
}
