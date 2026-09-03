import { useCallback, useState } from 'react'

import type { ProjectStats, Stats } from './dashboard-page-types'

export function useDashboardStats() {
  const [stats, setStats] = useState<Stats>({ total: 0, used: 0, expired: 0, active: 0 })
  const [projectStats, setProjectStats] = useState<ProjectStats[]>([])

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/codes/stats')
      const data = await response.json()
      if (data.success) {
        setStats(data.stats)
        setProjectStats(data.projectStats || [])
      }
    } catch (error) {
      console.error('获取统计数据失败:', error)
    }
  }, [])

  return {
    stats,
    setStats,
    projectStats,
    setProjectStats,
    fetchStats,
  }
}