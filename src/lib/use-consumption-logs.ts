import { useCallback, useState } from 'react'

import type { ConsumptionRefreshSource } from './consumption-refresh-status'
import { buildConsumptionQueryParams } from '@/lib/consumption-query-params'
import type { LicenseModeValue } from './license-status'

export type LicenseConsumptionLog = {
  id: number
  requestId: string
  machineId: string
  remainingCountAfter: number
  createdAt: string
  activationCode: {
    id: number
    code: string
    licenseMode: LicenseModeValue
    totalCount: number | null
    remainingCount: number | null
    project: {
      name: string
      projectKey: string
    }
  }
}

export type ConsumptionFilters = {
  projectKey: string
  keyword: string
  createdFrom: string
  createdTo: string
}

export type ConsumptionPagination = {
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type UseConsumptionLogsOptions = {
  pageSize?: number
}

export function useConsumptionLogs(options: UseConsumptionLogsOptions = {}) {
  const pageSize = options.pageSize ?? 10

  const [logs, setLogs] = useState<LicenseConsumptionLog[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshSource, setRefreshSource] = useState<ConsumptionRefreshSource>('initial')
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [pagination, setPagination] = useState<ConsumptionPagination>({
    total: 0,
    page: 1,
    pageSize,
    totalPages: 1,
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [projectFilter, setProjectFilter] = useState<'all' | string>('all')
  const [createdFrom, setCreatedFrom] = useState('')
  const [createdTo, setCreatedTo] = useState('')

  const fetchConsumptionLogs = useCallback(
    async (
      filters: ConsumptionFilters,
      page: number = 1,
      source: ConsumptionRefreshSource = 'manual',
    ) => {
      setLoading(true)
      setRefreshSource(source)
      setRefreshError(null)

      try {
        const params = buildConsumptionQueryParams(filters, { page, pageSize })
        const response = await fetch(`/api/admin/consumptions?${params}`)
        const data = await response.json()

        if (data.success) {
          setLogs(data.logs)
          setPagination(data.pagination)
          setCurrentPage(data.pagination.page)
          setLastRefreshedAt(new Date().toISOString())
        } else {
          setRefreshError(data.message || '加载消费日志失败')
        }
      } catch (error) {
        setRefreshError(
          error instanceof Error ? error.message : '加载消费日志失败',
        )
      } finally {
        setLoading(false)
      }
    },
    [pageSize],
  )

  const buildFilters = useCallback((): ConsumptionFilters => {
    return {
      projectKey: projectFilter === 'all' ? 'all' : projectFilter,
      keyword: searchTerm,
      createdFrom,
      createdTo,
    }
  }, [projectFilter, searchTerm, createdFrom, createdTo])

  const refresh = useCallback(
    (source: ConsumptionRefreshSource = 'manual') => {
      return fetchConsumptionLogs(buildFilters(), currentPage, source)
    },
    [fetchConsumptionLogs, buildFilters, currentPage],
  )

  const goToPage = useCallback(
    (page: number) => {
      return fetchConsumptionLogs(buildFilters(), page, 'manual')
    },
    [fetchConsumptionLogs, buildFilters],
  )

  return {
    logs,
    loading,
    refreshSource,
    lastRefreshedAt,
    refreshError,
    pagination,
    currentPage,
    searchTerm,
    setSearchTerm,
    projectFilter,
    setProjectFilter,
    createdFrom,
    setCreatedFrom,
    createdTo,
    setCreatedTo,
    fetchConsumptionLogs,
    buildFilters,
    refresh,
    goToPage,
  }
}