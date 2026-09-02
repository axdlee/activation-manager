import { useCallback, useState } from 'react'

import type { AdminOperationAuditLogEntry } from './dashboard-page-types'

export type AuditLogQueryFilters = {
  keyword: string
  projectKey: 'all' | string
  operationType: 'all' | string
  createdFrom: string
  createdTo: string
}

export type AuditLogPagination = {
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type AuditLogFetchResult = {
  success: boolean
  message?: string
}

export type UseAdminAuditLogsOptions = {
  pageSize?: number
}

export function useAdminAuditLogs(options: UseAdminAuditLogsOptions = {}) {
  const pageSize = options.pageSize ?? 10

  const [logs, setLogs] = useState<AdminOperationAuditLogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState<AuditLogPagination>({
    total: 0,
    page: 1,
    pageSize,
    totalPages: 1,
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [projectFilter, setProjectFilter] = useState<'all' | string>('all')
  const [operationTypeFilter, setOperationTypeFilter] = useState<'all' | string>('all')
  const [createdFrom, setCreatedFrom] = useState('')
  const [createdTo, setCreatedTo] = useState('')

  const buildFilters = useCallback(
    (overrides: Partial<AuditLogQueryFilters> = {}): AuditLogQueryFilters => {
      return {
        keyword: searchTerm,
        projectKey: projectFilter === 'all' ? 'all' : projectFilter,
        operationType: operationTypeFilter === 'all' ? 'all' : operationTypeFilter,
        createdFrom,
        createdTo,
        ...overrides,
      }
    },
    [searchTerm, projectFilter, operationTypeFilter, createdFrom, createdTo],
  )

  const fetchAdminAuditLogs = useCallback(
    async (
      filters: AuditLogQueryFilters,
      page: number = 1,
    ): Promise<AuditLogFetchResult> => {
      setLoading(true)

      try {
        const params = new URLSearchParams()
        if (filters.projectKey !== 'all') params.set('projectKey', filters.projectKey)
        if (filters.keyword.trim()) params.set('keyword', filters.keyword.trim())
        if (filters.operationType !== 'all') params.set('operationType', filters.operationType)
        if (filters.createdFrom) params.set('createdFrom', filters.createdFrom)
        if (filters.createdTo) params.set('createdTo', filters.createdTo)
        params.set('page', String(page))
        params.set('pageSize', String(pageSize))

        const response = await fetch(`/api/admin/audit-logs?${params.toString()}`)
        const data = await response.json()

        if (data.success) {
          setLogs(data.logs)
          setPagination(data.pagination)
          if (data.pagination?.page !== page) {
            setCurrentPage(data.pagination.page)
          }
          return { success: true }
        }

        return { success: false, message: data.message || '获取审计日志失败' }
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : '获取审计日志失败',
        }
      } finally {
        setLoading(false)
      }
    },
    [pageSize],
  )

  const refresh = useCallback(
    (page: number = currentPage) => {
      return fetchAdminAuditLogs(buildFilters(), page)
    },
    [fetchAdminAuditLogs, buildFilters, currentPage],
  )

  const goToPage = useCallback(
    (page: number) => {
      return fetchAdminAuditLogs(buildFilters(), page)
    },
    [fetchAdminAuditLogs, buildFilters],
  )

  return {
    logs,
    loading,
    pagination,
    currentPage,
    setCurrentPage,
    searchTerm,
    setSearchTerm,
    projectFilter,
    setProjectFilter,
    operationTypeFilter,
    setOperationTypeFilter,
    createdFrom,
    setCreatedFrom,
    createdTo,
    setCreatedTo,
    buildFilters,
    fetchAdminAuditLogs,
    refresh,
    goToPage,
  }
}