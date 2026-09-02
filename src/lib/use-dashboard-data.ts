import { useCallback, useState } from 'react'

import type { Project, ActivationCode } from './dashboard-page-types'
import type { SystemConfigItem } from '@/lib/system-config-ui'

export type UseDashboardDataOptions = {
  onShowMessage?: (message: string, type: 'success' | 'error') => void
}

export function useDashboardData(options: UseDashboardDataOptions = {}) {
  const { onShowMessage } = options
  const [projects, setProjects] = useState<Project[]>([])
  const [allCodes, setAllCodes] = useState<ActivationCode[]>([])
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

  const fetchAllCodesAction = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/codes/list')
      const data = await response.json()
      if (data.success) {
        setAllCodes(data.codes)
        return data.codes as ActivationCode[]
      }
      onShowMessage?.(data.message || '获取激活码列表失败', 'error')
    } catch (error) {
      onShowMessage?.('网络错误，请重试', 'error')
    } finally {
      setLoading(false)
    }
    return [] as ActivationCode[]
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
    allCodes,
    systemConfigs,
    loading,
    setProjects,
    setAllCodes,
    setSystemConfigs,
    setLoading,
    fetchProjects,
    fetchAllCodes: fetchAllCodesAction,
    fetchSystemConfigs: fetchSystemConfigsAction,
  }
}