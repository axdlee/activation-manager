import { useCallback, useState } from 'react'

import type { ActivationCode, Project } from './dashboard-page-types'
import type { SystemConfigItem } from '@/lib/system-config-ui'

export type CodeListData = {
  codes: ActivationCode[]
  total: number
  page: number
  totalPages: number
  statusSummary: { unused: number; inUse: number; risk: number }
  projectCoverage: number
  availableCardTypes: string[]
}

const EMPTY_CODE_LIST: CodeListData = {
  codes: [],
  total: 0,
  page: 1,
  totalPages: 1,
  statusSummary: { unused: 0, inUse: 0, risk: 0 },
  projectCoverage: 0,
  availableCardTypes: [],
}

export type UseDashboardDataOptions = {
  onShowMessage?: (message: string, type: 'success' | 'error') => void
}

export type CodeListFilters = {
  keyword?: string
  status?: string
  projectKey?: string
  cardType?: string
  page?: number
  pageSize?: number
}

export function useDashboardData(options: UseDashboardDataOptions = {}) {
  const { onShowMessage } = options
  const [projects, setProjects] = useState<Project[]>([])
  const [codeList, setCodeList] = useState<CodeListData>(EMPTY_CODE_LIST)
  const [systemConfigs, setSystemConfigs] = useState<SystemConfigItem[]>([])
  const [loading, setLoading] = useState(false)

  const fetchProjects = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/projects')
      const data = await response.json()
      if (data.success) {
        setProjects(data.projects)
        return data.projects
      }
    } catch (error) {
      console.error('获取项目列表失败:', error)
    }
    return [] as Project[]
  }, [])

  // 服务端分页+筛选的激活码列表（dashboard 激活码 tab 使用）
  const fetchCodeList = useCallback(async (filters?: CodeListFilters) => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filters?.keyword) params.set('keyword', filters.keyword)
      if (filters?.status && filters.status !== 'all') params.set('status', filters.status)
      if (filters?.projectKey && filters.projectKey !== 'all') params.set('projectKey', filters.projectKey)
      if (filters?.cardType && filters.cardType !== 'all') params.set('cardType', filters.cardType)
      params.set('page', String(filters?.page ?? 1))
      params.set('pageSize', String(filters?.pageSize ?? 10))

      const response = await fetch(`/api/admin/codes/list?${params}`)
      const data = await response.json()
      if (data.success) {
        const list: CodeListData = {
          codes: data.codes,
          total: data.total,
          page: data.page,
          totalPages: data.totalPages,
          statusSummary: data.statusSummary,
          projectCoverage: data.projectCoverage,
          availableCardTypes: data.availableCardTypes,
        }
        setCodeList(list)
        return list
      }
      onShowMessage?.(data.message || '获取激活码列表失败', 'error')
    } catch (error) {
      onShowMessage?.('网络错误，请重试', 'error')
    } finally {
      setLoading(false)
    }
    return EMPTY_CODE_LIST
  }, [onShowMessage])

  const fetchSystemConfigsAction = useCallback(async (): Promise<boolean> => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/system-config')
      const data = await response.json()
      if (data.success) {
        setSystemConfigs(data.configs)
        return true
      }
    } catch (error) {
      onShowMessage?.('获取系统配置失败', 'error')
    } finally {
      setLoading(false)
    }
    return false
  }, [onShowMessage])

  return {
    projects,
    codeList,
    systemConfigs,
    loading,
    setProjects,
    setCodeList,
    setSystemConfigs,
    setLoading,
    fetchProjects,
    fetchCodeList,
    fetchSystemConfigs: fetchSystemConfigsAction,
  }
}