'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

// 定义激活码接口
import {
  buildConsumptionAutoRefreshKey,
  CONSUMPTION_AUTO_REFRESH_DELAY_MS,
} from '@/lib/consumption-auto-refresh'
import { buildConsumptionTrendComparisonSeries } from '@/lib/consumption-trend-comparison'
import { getConsumptionQuickRange } from '@/lib/consumption-date-range'
import { getVisibleConsumptionTrendPoints } from '@/lib/consumption-trend-display'
import { buildConsumptionTrendExportUrl } from '@/lib/consumption-trend-export-url'
import {
  buildConsumptionQueryParams,
  type ConsumptionQueryFilters,
} from '@/lib/consumption-query-params'
import {
  getConsumptionRefreshStatus,
  getConsumptionRefreshStatusText,
  type ConsumptionRefreshSource,
} from '@/lib/consumption-refresh-status'
import {
  getActualExpiresAt,
  getCodeStatusLabel,
  getRemainingCount,
  isCountCodeDepleted,
  isCodeExpired,
  type LicenseModeValue,
} from '@/lib/license-status'
import {
  dashboardTabs,
  getDashboardTabMeta,
  type DashboardTabKey,
} from '@/lib/dashboard-tab-config'
import {
  activationCodeWorkspaceTabs,
  consumptionWorkspaceTabs,
  projectWorkspaceTabs,
  type ActivationCodeWorkspaceTab,
  type ConsumptionWorkspaceTab,
  type ProjectWorkspaceTab,
} from '@/lib/dashboard-workspace-tabs'
import { buildDashboardStatsCards } from '@/lib/dashboard-stats-cards'
import {
  buildProjectManagementPage,
  type ProjectManagementSortOption,
  type ProjectManagementStatusFilter,
} from '@/lib/project-management-list'
import { buildProjectStatsInsights } from '@/lib/project-stats-insights'
import { filterProjectStatsByProjectKey } from '@/lib/project-stats-filter'
import { summarizeProjectStats } from '@/lib/project-stats-summary'
import {
  buildSystemConfigPageModel,
  type SystemConfigItem as DashboardSystemConfigItem,
} from '@/lib/system-config-ui'
import { prepareSystemConfigUpdates } from '@/lib/system-config-updates'
import { buildChangePasswordPageModel } from '@/lib/change-password-ui'
import { ApiDocsWorkspace } from '@/components/api-docs-workspace'

interface Project {
  id: number
  name: string
  projectKey: string
  description: string | null
  isEnabled: boolean
  createdAt: string
}

interface ActivationCode {
  id: number
  code: string
  isUsed: boolean
  usedAt: string | null
  usedBy: string | null
  createdAt: string
  updatedAt?: string
  expiresAt: string | null
  validDays: number | null
  cardType: string | null
  projectId: number
  licenseMode: LicenseModeValue
  totalCount: number | null
  remainingCount: number | null
  consumedCount: number
  project?: {
    id: number
    name: string
    projectKey: string
  }
}

interface LicenseConsumptionLog {
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
      id: number
      name: string
      projectKey: string
    }
  }
}

interface Stats {
  total: number
  used: number
  expired: number
  active: number
}

interface ProjectStats {
  id: number
  name: string
  projectKey: string
  isEnabled: boolean
  totalCodes: number
  usedCodes: number
  expiredCodes: number
  activeCodes: number
  countRemainingTotal: number
  countConsumedTotal: number
}

interface ConsumptionTrendPoint {
  date: string
  label: string
  count: number
}

interface ConsumptionTrendComparison {
  previousRangeStart: string
  previousRangeEnd: string
  previousTotalConsumptions: number
  changeCount: number
  changePercentage: number | null
}

interface ConsumptionTrend {
  days: number
  granularity?: 'day' | 'week' | 'month'
  maxBucketConsumptions?: number
  totalConsumptions: number
  maxDailyConsumptions: number
  comparison: ConsumptionTrendComparison
  points: ConsumptionTrendPoint[]
}

interface CardType {
  name: string
  days: number
  description: string
}

type TabType = DashboardTabKey
type StatusFilter = 'all' | 'unused' | 'used' | 'expired' | 'depleted'

const statusFilterLabelMap: Record<StatusFilter, string> = {
  all: '全部状态',
  unused: '未激活',
  used: '已使用 / 使用中',
  expired: '已过期',
  depleted: '已耗尽',
}

const cardTypes: CardType[] = [
  { name: '周卡', days: 7, description: '7天有效期' },
  { name: '月卡', days: 30, description: '30天有效期' },
  { name: '季卡', days: 90, description: '90天有效期' },
  { name: '半年卡', days: 180, description: '180天有效期' },
  { name: '年卡', days: 365, description: '365天有效期' },
  { name: '自定义', days: 0, description: '自定义天数' },
]

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<TabType>('stats')
  const [amount, setAmount] = useState(1)
  const [expiryDays, setExpiryDays] = useState(30)
  const [selectedCardType, setSelectedCardType] = useState<string>('')
  const [customDays, setCustomDays] = useState(30)
  const [licenseMode, setLicenseMode] = useState<LicenseModeValue>('TIME')
  const [totalCount, setTotalCount] = useState(10)
  const [selectedProjectKey, setSelectedProjectKey] = useState('default')
  const [loading, setLoading] = useState(false)
  const [generatedCodes, setGeneratedCodes] = useState<ActivationCode[]>([])
  const [allCodes, setAllCodes] = useState<ActivationCode[]>([])
  const [consumptionLogs, setConsumptionLogs] = useState<LicenseConsumptionLog[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [projectStats, setProjectStats] = useState<ProjectStats[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, used: 0, expired: 0, active: 0 })
  const [consumptionTrend, setConsumptionTrend] = useState<ConsumptionTrend | null>(null)
  const [comparisonConsumptionTrend, setComparisonConsumptionTrend] = useState<ConsumptionTrend | null>(null)
  const [consumptionTrendDays, setConsumptionTrendDays] = useState<7 | 30>(7)
  const [consumptionTrendGranularity, setConsumptionTrendGranularity] =
    useState<'day' | 'week' | 'month'>('day')
  const [consumptionTrendCompareProjectKey, setConsumptionTrendCompareProjectKey] =
    useState<'none' | string>('none')
  const [consumptionTrendHideZeroBuckets, setConsumptionTrendHideZeroBuckets] = useState(false)
  const [consumptionTrendLoading, setConsumptionTrendLoading] = useState(false)
  const [consumptionTrendError, setConsumptionTrendError] = useState<string | null>(null)
  const [consumptionTrendCompareError, setConsumptionTrendCompareError] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [statsProjectFilter, setStatsProjectFilter] = useState<'all' | string>('all')
  const [cardTypeFilter, setCardTypeFilter] = useState<'all' | string>('all')
  const [projectFilter, setProjectFilter] = useState<'all' | string>('all')
  const [consumptionSearchTerm, setConsumptionSearchTerm] = useState('')
  const [consumptionProjectFilter, setConsumptionProjectFilter] = useState<'all' | string>('all')
  const [consumptionCreatedFrom, setConsumptionCreatedFrom] = useState('')
  const [consumptionCreatedTo, setConsumptionCreatedTo] = useState('')
  const [consumptionLoading, setConsumptionLoading] = useState(false)
  const [consumptionRefreshSource, setConsumptionRefreshSource] = useState<ConsumptionRefreshSource>('initial')
  const [consumptionLastRefreshedAt, setConsumptionLastRefreshedAt] = useState<string | null>(null)
  const [consumptionRefreshError, setConsumptionRefreshError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [consumptionCurrentPage, setConsumptionCurrentPage] = useState(1)
  const [projectManagementCurrentPage, setProjectManagementCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [systemConfigs, setSystemConfigs] = useState<DashboardSystemConfigItem[]>([])
  const [revealedSensitiveConfigKeys, setRevealedSensitiveConfigKeys] = useState<string[]>([])
  const [revealedPasswordFieldKeys, setRevealedPasswordFieldKeys] = useState<string[]>([])
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectKey, setNewProjectKey] = useState('')
  const [newProjectDescription, setNewProjectDescription] = useState('')
  const [projectNameDrafts, setProjectNameDrafts] = useState<Record<number, string>>({})
  const [projectDescriptionDrafts, setProjectDescriptionDrafts] = useState<Record<number, string>>({})
  const [projectManagementSearchTerm, setProjectManagementSearchTerm] = useState('')
  const [projectManagementStatusFilter, setProjectManagementStatusFilter] =
    useState<ProjectManagementStatusFilter>('all')
  const [projectManagementSortBy, setProjectManagementSortBy] =
    useState<ProjectManagementSortOption>('createdAtDesc')
  const [activationCodeWorkspaceTab, setActivationCodeWorkspaceTab] =
    useState<ActivationCodeWorkspaceTab>('results')
  const [consumptionWorkspaceTab, setConsumptionWorkspaceTab] =
    useState<ConsumptionWorkspaceTab>('logs')
  const [projectWorkspaceTab, setProjectWorkspaceTab] = useState<ProjectWorkspaceTab>('manage')
  const router = useRouter()
  const hasConsumptionAutoRefreshInitializedRef = useRef(false)
  const skipNextConsumptionAutoRefreshRef = useRef(false)
  const hasFetchedInitialProjectsRef = useRef(false)
  const lastLoadedDashboardTabRef = useRef<TabType | null>(null)
  const fetchConsumptionLogsRef = useRef<
    null | ((overrides?: Partial<ConsumptionQueryFilters>, source?: ConsumptionRefreshSource) => Promise<void>)
  >(null)

  const showMessage = useCallback((content: string, type: 'success' | 'error' = 'success') => {
    setMessage(content)
    setMessageType(type)
  }, [])

  const handleCardTypeChange = (cardType: string) => {
    setSelectedCardType(cardType)
    const selectedCard = cardTypes.find((item) => item.name === cardType)
    if (selectedCard && selectedCard.days > 0) {
      setExpiryDays(selectedCard.days)
    }
  }

  const fetchProjects = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/projects')
      const data = await response.json()
      if (data.success) {
        setProjects(data.projects)

        const nextProjectNameDrafts: Record<number, string> = {}
        const nextProjectDescriptionDrafts: Record<number, string> = {}

        data.projects.forEach((project: Project) => {
          nextProjectNameDrafts[project.id] = project.name
          nextProjectDescriptionDrafts[project.id] = project.description || ''
        })

        setProjectNameDrafts(nextProjectNameDrafts)
        setProjectDescriptionDrafts(nextProjectDescriptionDrafts)
        const enabledProjects = data.projects.filter((project: Project) => project.isEnabled)
        const hasSelectedEnabledProject = enabledProjects.some(
          (project: Project) => project.projectKey === selectedProjectKey,
        )

        if (!hasSelectedEnabledProject) {
          const fallbackProject = enabledProjects[0] || data.projects[0]
          if (fallbackProject) {
            setSelectedProjectKey(fallbackProject.projectKey)
          }
        }

        const hasStatsProjectFilter = data.projects.some(
          (project: Project) => project.projectKey === statsProjectFilter,
        )

        if (statsProjectFilter !== 'all' && !hasStatsProjectFilter) {
          setStatsProjectFilter('all')
        }

        const hasTrendCompareProject = data.projects.some(
          (project: Project) => project.projectKey === consumptionTrendCompareProjectKey,
        )

        if (
          consumptionTrendCompareProjectKey !== 'none' &&
          (!hasTrendCompareProject ||
            (statsProjectFilter !== 'all' && consumptionTrendCompareProjectKey === statsProjectFilter))
        ) {
          setConsumptionTrendCompareProjectKey('none')
        }
      }
    } catch (error) {
      console.error('获取项目列表失败:', error)
    }
  }, [consumptionTrendCompareProjectKey, selectedProjectKey, statsProjectFilter])

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

  const fetchConsumptionTrend = useCallback(async () => {
    try {
      setConsumptionTrendLoading(true)
      setConsumptionTrendError(null)
      setConsumptionTrendCompareError(null)

      const primaryParams = new URLSearchParams({
        days: String(consumptionTrendDays),
        granularity: consumptionTrendGranularity,
      })

      if (statsProjectFilter !== 'all') {
        primaryParams.set('projectKey', statsProjectFilter)
      }

      const shouldCompareTrend =
        consumptionTrendCompareProjectKey !== 'none' &&
        (statsProjectFilter === 'all' || consumptionTrendCompareProjectKey !== statsProjectFilter)

      const compareParams = new URLSearchParams({
        days: String(consumptionTrendDays),
        granularity: consumptionTrendGranularity,
      })

      if (shouldCompareTrend) {
        compareParams.set('projectKey', consumptionTrendCompareProjectKey)
      }

      const [primaryResult, compareResult] = await Promise.allSettled([
        fetch(`/api/admin/consumptions/trend?${primaryParams.toString()}`).then((response) =>
          response.json(),
        ),
        shouldCompareTrend
          ? fetch(`/api/admin/consumptions/trend?${compareParams.toString()}`).then((response) =>
              response.json(),
            )
          : Promise.resolve(null),
      ])

      if (primaryResult.status !== 'fulfilled') {
        throw primaryResult.reason
      }

      const data = primaryResult.value

      if (data.success) {
        setConsumptionTrend(data.trend)
        setConsumptionTrendError(null)
      } else {
        setConsumptionTrend(null)
        setComparisonConsumptionTrend(null)
        setConsumptionTrendError(data.message || '获取消费趋势失败')
        return
      }

      if (!shouldCompareTrend) {
        setComparisonConsumptionTrend(null)
        setConsumptionTrendCompareError(null)
      } else if (compareResult.status === 'fulfilled' && compareResult.value?.success) {
        setComparisonConsumptionTrend(compareResult.value.trend)
        setConsumptionTrendCompareError(null)
      } else {
        setComparisonConsumptionTrend(null)
        setConsumptionTrendCompareError(
          compareResult.status === 'fulfilled'
            ? compareResult.value?.message || '获取对比项目趋势失败'
            : '获取对比项目趋势失败',
        )
      }
    } catch (error) {
      setConsumptionTrend(null)
      setComparisonConsumptionTrend(null)
      setConsumptionTrendError('获取消费趋势失败')
      console.error('获取消费趋势失败:', error)
    } finally {
      setConsumptionTrendLoading(false)
    }
  }, [
    consumptionTrendCompareProjectKey,
    consumptionTrendDays,
    consumptionTrendGranularity,
    statsProjectFilter,
  ])

  const handleExportConsumptionTrend = () => {
    try {
      window.open(
        buildConsumptionTrendExportUrl({
          days: consumptionTrendDays,
          granularity: consumptionTrendGranularity,
          projectKey: statsProjectFilter,
          compareProjectKey: consumptionTrendCompareProjectKey,
          hideZeroBuckets: consumptionTrendHideZeroBuckets,
        }),
        '_blank',
      )
    } catch (error) {
      showMessage('导出消费趋势失败', 'error')
    }
  }

  const fetchSystemConfigs = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/system-config')
      const data = await response.json()
      if (data.success) {
        setSystemConfigs(data.configs)
        setRevealedSensitiveConfigKeys([])
      } else {
        showMessage(data.message || '获取系统配置失败', 'error')
      }
    } catch (error) {
      showMessage('网络错误，请重试', 'error')
    } finally {
      setLoading(false)
    }
  }, [showMessage])

  const fetchAllCodes = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/codes/list')
      const data = await response.json()
      if (data.success) {
        setAllCodes(data.codes)
      } else {
        showMessage(data.message || '获取激活码列表失败', 'error')
      }
    } catch (error) {
      showMessage('网络错误，请重试', 'error')
    } finally {
      setLoading(false)
    }
  }, [showMessage])

  const currentConsumptionFilters = useMemo<ConsumptionQueryFilters>(() => ({
    projectKey: consumptionProjectFilter,
    keyword: consumptionSearchTerm,
    createdFrom: consumptionCreatedFrom,
    createdTo: consumptionCreatedTo,
  }), [
    consumptionCreatedFrom,
    consumptionCreatedTo,
    consumptionProjectFilter,
    consumptionSearchTerm,
  ])
  const consumptionAutoRefreshKey = useMemo(
    () => buildConsumptionAutoRefreshKey(currentConsumptionFilters),
    [currentConsumptionFilters],
  )

  const buildCurrentConsumptionFilters = useCallback((
    overrides: Partial<ConsumptionQueryFilters> = {},
  ): ConsumptionQueryFilters => ({
    ...currentConsumptionFilters,
    ...overrides,
  }), [currentConsumptionFilters])

  const fetchConsumptionLogs = useCallback(async (
    overrides: Partial<ConsumptionQueryFilters> = {},
    source: ConsumptionRefreshSource = 'manual',
  ) => {
    try {
      setConsumptionLoading(true)
      setConsumptionRefreshSource(source)
      setConsumptionRefreshError(null)
      const params = buildConsumptionQueryParams(buildCurrentConsumptionFilters(overrides))
      const requestUrl = params.toString()
        ? `/api/admin/consumptions?${params.toString()}`
        : '/api/admin/consumptions'
      const response = await fetch(requestUrl)
      const data = await response.json()
      if (data.success) {
        setConsumptionLogs(data.logs)
        setConsumptionLastRefreshedAt(new Date().toISOString())
        setConsumptionRefreshError(null)
      } else {
        const errorMessage = data.message || '获取消费日志失败'
        setConsumptionRefreshError(errorMessage)
        if (source !== 'auto') {
          showMessage(errorMessage, 'error')
        }
      }
    } catch (error) {
      const errorMessage = '网络错误，请重试'
      setConsumptionRefreshError(errorMessage)
      if (source !== 'auto') {
        showMessage(errorMessage, 'error')
      }
    } finally {
      setConsumptionLoading(false)
    }
  }, [buildCurrentConsumptionFilters, showMessage])

  useEffect(() => {
    fetchConsumptionLogsRef.current = fetchConsumptionLogs
  }, [fetchConsumptionLogs])

  useEffect(() => {
    if (hasFetchedInitialProjectsRef.current) {
      return
    }

    hasFetchedInitialProjectsRef.current = true
    void fetchProjects()
  }, [fetchProjects])

  useEffect(() => {
    if (lastLoadedDashboardTabRef.current === activeTab) {
      return
    }

    lastLoadedDashboardTabRef.current = activeTab

    if (activeTab === 'generate' || activeTab === 'list' || activeTab === 'projects' || activeTab === 'consumptions') {
      void fetchProjects()
    }
    if (activeTab === 'list') {
      void fetchAllCodes()
    }
    if (activeTab === 'consumptions') {
      void fetchConsumptionLogs({}, 'initial')
    }
    if (activeTab === 'systemConfig') {
      void fetchSystemConfigs()
    }
    if (activeTab === 'stats') {
      void fetchStats()
    }
  }, [activeTab, fetchAllCodes, fetchConsumptionLogs, fetchProjects, fetchStats, fetchSystemConfigs])

  useEffect(() => {
    if (activeTab !== 'stats') {
      return
    }

    void fetchConsumptionTrend()
  }, [activeTab, fetchConsumptionTrend])

  useEffect(() => {
    if (activeTab !== 'consumptions') {
      hasConsumptionAutoRefreshInitializedRef.current = false
      skipNextConsumptionAutoRefreshRef.current = false
      return
    }

    if (!hasConsumptionAutoRefreshInitializedRef.current) {
      hasConsumptionAutoRefreshInitializedRef.current = true
      return
    }

    if (skipNextConsumptionAutoRefreshRef.current) {
      skipNextConsumptionAutoRefreshRef.current = false
      return
    }

    const timer = window.setTimeout(() => {
      void fetchConsumptionLogsRef.current?.({}, 'auto')
    }, CONSUMPTION_AUTO_REFRESH_DELAY_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [activeTab, consumptionAutoRefreshKey])

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' })
      router.push('/admin/login')
    } catch (error) {
      console.error('登出失败:', error)
    }
  }

  const handleDeleteCode = async (id: number) => {
    if (!confirm('确定要删除这个激活码吗？')) return

    try {
      const response = await fetch('/api/admin/codes/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id }),
      })

      const data = await response.json()
      if (data.success) {
        showMessage('激活码删除成功')
        fetchAllCodes()
        fetchStats()
      } else {
        showMessage(data.message || '删除失败', 'error')
      }
    } catch (error) {
      showMessage('网络错误，请重试', 'error')
    }
  }

  const handleCleanupExpired = async () => {
    if (!confirm('确定要清理所有过期激活码的绑定关系吗？这将允许之前绑定过期激活码的机器使用新激活码。')) return

    try {
      setLoading(true)
      const response = await fetch('/api/admin/codes/cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()
      if (data.success) {
        showMessage(data.message)
        fetchAllCodes()
        fetchStats()
      } else {
        showMessage(data.message || '清理失败', 'error')
      }
    } catch (error) {
      showMessage('网络错误，请重试', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')

    if (!currentPassword || !newPassword || !confirmPassword) {
      showMessage('请填写所有密码字段', 'error')
      return
    }

    if (newPassword !== confirmPassword) {
      showMessage('新密码与确认密码不匹配', 'error')
      return
    }

    if (newPassword.length < 6) {
      showMessage('新密码长度不能少于6位', 'error')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      })

      const data = await response.json()
      if (data.success) {
        showMessage(data.message)
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setRevealedPasswordFieldKeys([])
        setTimeout(() => {
          handleLogout()
        }, 3000)
      } else {
        showMessage(data.message || '密码修改失败', 'error')
      }
    } catch (error) {
      showMessage('网络错误，请重试', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateSystemConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const configs = prepareSystemConfigUpdates(systemConfigs)
      const response = await fetch('/api/admin/system-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ configs }),
      })

      const data = await response.json()
      if (data.success) {
        showMessage(data.message)
        await fetchSystemConfigs()
      } else {
        showMessage(data.message || '系统配置更新失败', 'error')
      }
    } catch (error) {
      showMessage('网络错误，请重试', 'error')
    } finally {
      setLoading(false)
    }
  }

  const updateConfigValue = (key: string, value: DashboardSystemConfigItem['value']) => {
    setSystemConfigs((prev) =>
      prev.map((config) => (config.key === key ? { ...config, value } : config)),
    )
  }

  const handleGenerateCodes = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return

    try {
      setLoading(true)

      const finalExpiryDays = selectedCardType === '自定义' ? customDays : expiryDays
      const finalCardType = selectedCardType || null
      const payload = {
        amount,
        projectKey: selectedProjectKey,
        licenseMode,
        expiryDays: licenseMode === 'TIME' ? finalExpiryDays : null,
        totalCount: licenseMode === 'COUNT' ? totalCount : null,
        cardType: licenseMode === 'TIME' ? finalCardType : null,
      }

      const response = await fetch('/api/admin/codes/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (data.success) {
        setGeneratedCodes(data.codes)
        showMessage(data.message)
        fetchStats()
        if (activeTab === 'list') {
          fetchAllCodes()
        }
      } else {
        showMessage(data.message || '生成失败', 'error')
      }
    } catch (error) {
      showMessage('网络错误，请重试', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProjectName || !newProjectKey) {
      showMessage('项目名称和项目标识不能为空', 'error')
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/admin/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newProjectName,
          projectKey: newProjectKey,
          description: newProjectDescription,
        }),
      })

      const data = await response.json()
      if (data.success) {
        showMessage(data.message)
        setNewProjectName('')
        setNewProjectKey('')
        setNewProjectDescription('')
        setProjectWorkspaceTab('manage')
        setProjectManagementCurrentPage(1)
        fetchProjects()
      } else {
        showMessage(data.message || '项目创建失败', 'error')
      }
    } catch (error) {
      showMessage('网络错误，请重试', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleProjectStatus = async (project: Project) => {
    const actionLabel = project.isEnabled ? '停用' : '启用'
    if (!confirm(`确定要${actionLabel}项目「${project.name}」吗？`)) return

    try {
      setLoading(true)
      const response = await fetch(`/api/admin/projects/${project.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isEnabled: !project.isEnabled,
        }),
      })

      const data = await response.json()
      if (data.success) {
        showMessage(data.message)
        fetchProjects()
        fetchStats()
      } else {
        showMessage(data.message || '更新项目状态失败', 'error')
      }
    } catch (error) {
      showMessage('网络错误，请重试', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleProjectNameChange = (projectId: number, value: string) => {
    setProjectNameDrafts((currentDrafts) => ({
      ...currentDrafts,
      [projectId]: value,
    }))
  }

  const handleSaveProjectName = async (project: Project) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/projects/${project.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: projectNameDrafts[project.id] ?? project.name,
        }),
      })

      const data = await response.json()
      if (data.success) {
        showMessage(data.message)
        await fetchProjects()
        await fetchStats()
      } else {
        showMessage(data.message || '更新项目名称失败', 'error')
      }
    } catch (error) {
      showMessage('网络错误，请重试', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleProjectDescriptionChange = (projectId: number, value: string) => {
    setProjectDescriptionDrafts((currentDrafts) => ({
      ...currentDrafts,
      [projectId]: value,
    }))
  }

  const handleSaveProjectDescription = async (project: Project) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/projects/${project.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: projectDescriptionDrafts[project.id] ?? '',
        }),
      })

      const data = await response.json()
      if (data.success) {
        showMessage(data.message)
        await fetchProjects()
      } else {
        showMessage(data.message || '更新项目描述失败', 'error')
      }
    } catch (error) {
      showMessage('网络错误，请重试', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteProject = async (project: Project) => {
    if (!confirm(`确定要删除项目「${project.name}」吗？只有空项目才允许删除。`)) return

    try {
      setLoading(true)
      const response = await fetch(`/api/admin/projects/${project.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (data.success) {
        showMessage(data.message)
        fetchProjects()
        fetchStats()
      } else {
        showMessage(data.message || '删除项目失败', 'error')
      }
    } catch (error) {
      showMessage('网络错误，请重试', 'error')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async (text: string, successMessage = '已复制到剪贴板') => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('clipboard not supported')
      }

      await navigator.clipboard.writeText(text)
      showMessage(successMessage)
    } catch (error) {
      showMessage('当前环境不支持自动复制，请手动复制', 'error')
    }
  }

  const getProjectDisplay = (code: ActivationCode) => code.project?.name || '默认项目'

  const getLicenseModeDisplay = (mode: LicenseModeValue) => (mode === 'COUNT' ? '次数型' : '时间型')

  const getSpecDisplay = (code: ActivationCode) => {
    if (code.licenseMode === 'COUNT') {
      return `${code.totalCount || 0} 次`
    }

    if (code.cardType) {
      return code.cardType
    }

    return code.validDays ? `${code.validDays}天` : '无限期'
  }

  const getExpiryDisplay = (code: ActivationCode) => {
    if (code.licenseMode === 'COUNT') {
      return '-'
    }

    if (!code.isUsed) {
      return code.validDays ? `${code.validDays}天（激活后生效）` : '无限期'
    }

    const actualExpiresAt = getActualExpiresAt(code)
    return actualExpiresAt ? actualExpiresAt.toLocaleString() : '无限期'
  }

  const getRemainingDisplay = (code: ActivationCode) => {
    if (code.licenseMode !== 'COUNT') {
      return '-'
    }

    return `${getRemainingCount(code) ?? 0} / ${code.totalCount ?? 0}`
  }

  const exportCodes = (codes: ActivationCode[]) => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      '项目,激活码,授权类型,规格,状态,创建时间,过期时间,剩余次数,已用次数,使用时间,使用者\n' +
      codes
        .map((code) => {
          const status = getCodeStatusLabel(code)
          return [
            getProjectDisplay(code),
            code.code,
            getLicenseModeDisplay(code.licenseMode),
            getSpecDisplay(code),
            status,
            new Date(code.createdAt).toLocaleString(),
            getExpiryDisplay(code),
            code.licenseMode === 'COUNT' ? String(code.remainingCount ?? 0) : '',
            code.licenseMode === 'COUNT' ? String(code.consumedCount ?? 0) : '',
            code.usedAt ? new Date(code.usedAt).toLocaleString() : '',
            code.usedBy || '',
          ].join(',')
        })
        .join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `activation_codes_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const filteredCodes = allCodes.filter((code) => {
    const matchesSearch =
      code.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (code.usedBy && code.usedBy.toLowerCase().includes(searchTerm.toLowerCase()))

    const statusLabel = getCodeStatusLabel(code)
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'unused' && statusLabel === '未激活') ||
      (statusFilter === 'used' && (statusLabel === '已使用' || statusLabel === '使用中')) ||
      (statusFilter === 'expired' && statusLabel === '已过期') ||
      (statusFilter === 'depleted' && statusLabel === '已耗尽')

    const matchesCardType =
      cardTypeFilter === 'all'
        ? true
        : cardTypeFilter === 'none'
          ? !code.cardType
          : code.cardType === cardTypeFilter

    const matchesProject =
      projectFilter === 'all' ? true : code.project?.projectKey === projectFilter

    return matchesSearch && matchesStatus && matchesCardType && matchesProject
  })
  const activationCodeStatusSummary = filteredCodes.reduce(
    (summary, code) => {
      const status = getCodeStatusLabel(code)

      if (status === '未激活') {
        summary.unused += 1
      } else if (status === '已过期' || status === '已耗尽') {
        summary.risk += 1
      } else {
        summary.inUse += 1
      }

      return summary
    },
    { unused: 0, inUse: 0, risk: 0 },
  )
  const activationCodeProjectCoverage = new Set(
    filteredCodes.map((code) => code.project?.projectKey || `project-${code.projectId}`),
  ).size
  const activationCodeFilterTokens = [
    searchTerm.trim() ? `关键词：${searchTerm.trim()}` : null,
    statusFilter !== 'all' ? `状态：${statusFilterLabelMap[statusFilter]}` : null,
    projectFilter !== 'all'
      ? `项目：${projects.find((project) => project.projectKey === projectFilter)?.name || projectFilter}`
      : null,
    cardTypeFilter !== 'all'
      ? `套餐：${cardTypeFilter === 'none' ? '无套餐类型' : cardTypeFilter}`
      : null,
  ].filter((token): token is string => Boolean(token))

  const totalPages = Math.ceil(filteredCodes.length / itemsPerPage)
  const activationCodeStartIndex =
    filteredCodes.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1
  const activationCodeEndIndex =
    filteredCodes.length === 0 ? 0 : Math.min(currentPage * itemsPerPage, filteredCodes.length)
  const paginatedCodes = filteredCodes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  )
  const filteredProjectStats = filterProjectStatsByProjectKey(projectStats, statsProjectFilter)
  const summarizedProjectStats = summarizeProjectStats(filteredProjectStats)
  const selectedStatsProject =
    statsProjectFilter === 'all'
      ? null
      : projects.find((project) => project.projectKey === statsProjectFilter) || null
  const displayStats =
    statsProjectFilter === 'all'
      ? {
          ...stats,
          countRemainingTotal: summarizedProjectStats.countRemainingTotal,
          countConsumedTotal: summarizedProjectStats.countConsumedTotal,
        }
      : summarizedProjectStats
  const projectStatsInsights = buildProjectStatsInsights(filteredProjectStats)
  const statsCards = buildDashboardStatsCards(displayStats)
  const statsScopeLabel = selectedStatsProject?.name || '全部项目'
  const countUsageRateText = `${projectStatsInsights.countUsageRate}%`
  const countUsageRateDescription =
    projectStatsInsights.totalCountCapacity > 0
      ? `次数型总容量 ${projectStatsInsights.totalCountCapacity}，已消耗 ${displayStats.countConsumedTotal}，剩余 ${displayStats.countRemainingTotal}`
      : '当前统计范围内暂无次数型激活码容量'
  const peakConsumptionProjectText = projectStatsInsights.peakConsumptionProject
    ? `${projectStatsInsights.peakConsumptionProject.name}`
    : '暂无消费'
  const peakConsumptionProjectDescription = projectStatsInsights.peakConsumptionProject
    ? `项目标识 ${projectStatsInsights.peakConsumptionProject.projectKey}，累计消耗 ${projectStatsInsights.peakConsumptionProject.countConsumedTotal} 次`
    : '当前统计范围内还没有次数型扣次记录'
  const availableConsumptionTrendCompareProjects = projects.filter(
    (project) => statsProjectFilter === 'all' || project.projectKey !== statsProjectFilter,
  )
  const selectedComparisonProject =
    consumptionTrendCompareProjectKey === 'none'
      ? null
      : projects.find((project) => project.projectKey === consumptionTrendCompareProjectKey) || null
  const consumptionTrendGranularityLabel =
    consumptionTrendGranularity === 'week'
      ? '每周'
      : consumptionTrendGranularity === 'month'
        ? '每月'
        : '每日'
  const consumptionTrendPeakValue =
    consumptionTrend?.maxBucketConsumptions ?? consumptionTrend?.maxDailyConsumptions ?? 0
  const consumptionTrendPeakLabel =
    consumptionTrendGranularity === 'week'
      ? '峰值周扣次'
      : consumptionTrendGranularity === 'month'
        ? '峰值月扣次'
        : '峰值日扣次'
  const consumptionTrendAverage =
    consumptionTrend && consumptionTrend.days > 0
      ? Number((consumptionTrend.totalConsumptions / consumptionTrend.days).toFixed(1))
      : 0
  const consumptionTrendComparison = consumptionTrend?.comparison
  const consumptionTrendComparisonValue = consumptionTrendComparison
    ? consumptionTrendComparison.changePercentage === null
      ? consumptionTrendComparison.changeCount > 0
        ? '新增'
        : '持平'
      : `${consumptionTrendComparison.changeCount > 0 ? '+' : ''}${consumptionTrendComparison.changePercentage}%`
    : '--'
  const consumptionTrendComparisonDescription = consumptionTrendComparison
    ? `上一周期（${consumptionTrendComparison.previousRangeStart} ~ ${consumptionTrendComparison.previousRangeEnd}）总扣次 ${consumptionTrendComparison.previousTotalConsumptions}，当前${consumptionTrendComparison.changeCount > 0 ? '增加' : consumptionTrendComparison.changeCount < 0 ? '减少' : '持平'} ${Math.abs(consumptionTrendComparison.changeCount)} 次`
    : '当前周期与上一周期的总扣次对比'
  const hasComparisonConsumptionTrend = Boolean(selectedComparisonProject && comparisonConsumptionTrend)
  const comparisonTrendSeries = hasComparisonConsumptionTrend
    ? buildConsumptionTrendComparisonSeries(
        consumptionTrend?.points ?? [],
        comparisonConsumptionTrend?.points ?? [],
        {
          hideZeroBuckets: consumptionTrendHideZeroBuckets,
        },
      )
    : null
  const visibleConsumptionTrend = hasComparisonConsumptionTrend
    ? null
    : getVisibleConsumptionTrendPoints(consumptionTrend?.points ?? [], {
        hideZeroBuckets: consumptionTrendHideZeroBuckets,
      })
  const visibleConsumptionTrendPoints = visibleConsumptionTrend?.points ?? []
  const hiddenZeroBucketCount = comparisonTrendSeries
    ? comparisonTrendSeries.hiddenZeroBucketCount
    : (visibleConsumptionTrend?.hiddenZeroBucketCount ?? 0)
  const hasVisibleConsumptionTrendPoints = comparisonTrendSeries
    ? comparisonTrendSeries.points.length > 0
    : visibleConsumptionTrendPoints.length > 0
  const consumptionTrendChartMaxCount = comparisonTrendSeries
    ? comparisonTrendSeries.maxCount
    : (consumptionTrend?.maxBucketConsumptions ?? consumptionTrend?.maxDailyConsumptions ?? 0)
  const hasConsumptionTrendData = hasComparisonConsumptionTrend
    ? (consumptionTrend?.totalConsumptions ?? 0) > 0 || (comparisonConsumptionTrend?.totalConsumptions ?? 0) > 0
    : Boolean(consumptionTrend?.points.some((point) => point.count > 0))
  const comparisonTrendTotalConsumptions = comparisonConsumptionTrend?.totalConsumptions ?? 0
  const comparisonTrendDifference = consumptionTrend
    ? consumptionTrend.totalConsumptions - comparisonTrendTotalConsumptions
    : 0
  const comparisonTrendDifferenceText = hasComparisonConsumptionTrend
    ? `${comparisonTrendDifference > 0 ? '+' : ''}${comparisonTrendDifference}`
    : '--'
  const comparisonTrendDifferenceDescription = hasComparisonConsumptionTrend && selectedComparisonProject
    ? `${statsScopeLabel} 相比 ${selectedComparisonProject.name} 的累计扣次差值`
    : '主项目与对比项目的累计扣次差值'
  const changePasswordPageModel = buildChangePasswordPageModel({
    currentPassword,
    newPassword,
    confirmPassword,
  })
  const completedPasswordChecklistCount = changePasswordPageModel.checklist.filter(
    (item) => item.satisfied,
  ).length
  const systemConfigPageModel = buildSystemConfigPageModel(systemConfigs)
  const systemConfigSensitiveCount = systemConfigPageModel.groups.reduce(
    (count, group) => count + group.items.filter((item) => item.sensitive).length,
    0,
  )
  const systemConfigWhitelistEntryCount = systemConfigPageModel.groups.reduce((count, group) => {
    const whitelistItem = group.items.find((item) => item.key === 'allowedIPs')
    return count + (whitelistItem?.previewTokens?.length || 0)
  }, 0)
  const activeTabMeta = getDashboardTabMeta(activeTab)
  const heroMetricCards = [
    {
      label: '项目总数',
      value: projects.length,
      description: '当前后台已接入的项目数量',
    },
    {
      label: '激活码总量',
      value: stats.total || allCodes.length,
      description: '基于全局统计汇总的发码规模',
    },
    {
      label: '消费日志',
      value: consumptionLogs.length,
      description: '已拉取的次数扣减记录数量',
    },
  ]
  const projectManagementPage = buildProjectManagementPage(projects, {
    keyword: projectManagementSearchTerm,
    status: projectManagementStatusFilter,
    sortBy: projectManagementSortBy,
    page: projectManagementCurrentPage,
    pageSize: itemsPerPage,
  })
  const paginatedManageProjects = projectManagementPage.items
  const enabledProjectsCount = projects.filter((project) => project.isEnabled).length
  const disabledProjectsCount = projects.length - enabledProjectsCount
  const projectManagementStartIndex =
    projectManagementPage.totalItems === 0
      ? 0
      : (projectManagementPage.currentPage - 1) * projectManagementPage.pageSize + 1
  const projectManagementEndIndex =
    projectManagementPage.totalItems === 0
      ? 0
      : Math.min(
          projectManagementPage.currentPage * projectManagementPage.pageSize,
          projectManagementPage.totalItems,
        )

  const getProjectNameDraft = (project: Project) => projectNameDrafts[project.id] ?? project.name
  const hasProjectNameChanged = (project: Project) =>
    getProjectNameDraft(project).trim() !== project.name.trim()
  const getProjectDescriptionDraft = (project: Project) => projectDescriptionDrafts[project.id] ?? (project.description || '')
  const hasProjectDescriptionChanged = (project: Project) =>
    getProjectDescriptionDraft(project).trim() !== (project.description || '').trim()

  const getStatusBadge = (code: ActivationCode) => {
    const status = getCodeStatusLabel(code)

    if (status === '已过期') {
      return <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">已过期</span>
    }
    if (status === '已耗尽') {
      return <span className="px-2 py-1 text-xs rounded-full bg-orange-100 text-orange-800">已耗尽</span>
    }
    if (status === '已使用' || status === '使用中') {
      return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">{status}</span>
    }

    return <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">未激活</span>
  }

  const getAvailableCardTypes = () => {
    const types = new Set<string>()
    allCodes.forEach((code) => {
      if (code.cardType) {
        types.add(code.cardType)
      }
    })
    return Array.from(types).sort()
  }

  const filteredConsumptionLogs = consumptionLogs.filter((log) => {
    const keyword = consumptionSearchTerm.trim().toLowerCase()
    const matchesSearch =
      !keyword ||
      log.requestId.toLowerCase().includes(keyword) ||
      log.machineId.toLowerCase().includes(keyword) ||
      log.activationCode.code.toLowerCase().includes(keyword)

    const matchesProject =
      consumptionProjectFilter === 'all'
        ? true
        : log.activationCode.project.projectKey === consumptionProjectFilter

    const logTimestamp = new Date(log.createdAt).getTime()
    const createdFromTimestamp = consumptionCreatedFrom ? new Date(consumptionCreatedFrom).getTime() : null
    const createdToTimestamp = consumptionCreatedTo ? new Date(consumptionCreatedTo).getTime() : null
    const matchesCreatedFrom = createdFromTimestamp === null || logTimestamp >= createdFromTimestamp
    const matchesCreatedTo = createdToTimestamp === null || logTimestamp <= createdToTimestamp

    return matchesSearch && matchesProject && matchesCreatedFrom && matchesCreatedTo
  })
  const consumptionProjectCoverage = new Set(
    filteredConsumptionLogs.map((log) => log.activationCode.project.projectKey),
  ).size
  const consumptionCodeCoverage = new Set(
    filteredConsumptionLogs.map((log) => log.activationCode.id),
  ).size
  const consumptionFilterTokens = [
    consumptionSearchTerm.trim() ? `关键词：${consumptionSearchTerm.trim()}` : null,
    consumptionProjectFilter !== 'all'
      ? `项目：${projects.find((project) => project.projectKey === consumptionProjectFilter)?.name || consumptionProjectFilter}`
      : null,
    consumptionCreatedFrom ? `开始：${new Date(consumptionCreatedFrom).toLocaleString()}` : null,
    consumptionCreatedTo ? `结束：${new Date(consumptionCreatedTo).toLocaleString()}` : null,
  ].filter((token): token is string => Boolean(token))

  const consumptionTotalPages = Math.ceil(filteredConsumptionLogs.length / itemsPerPage)
  const consumptionStartIndex =
    filteredConsumptionLogs.length === 0 ? 0 : (consumptionCurrentPage - 1) * itemsPerPage + 1
  const consumptionEndIndex =
    filteredConsumptionLogs.length === 0
      ? 0
      : Math.min(consumptionCurrentPage * itemsPerPage, filteredConsumptionLogs.length)
  const paginatedConsumptionLogs = filteredConsumptionLogs.slice(
    (consumptionCurrentPage - 1) * itemsPerPage,
    consumptionCurrentPage * itemsPerPage,
  )
  const consumptionRefreshStatus = getConsumptionRefreshStatus({
    isLoading: consumptionLoading,
    refreshSource: consumptionRefreshSource,
    lastRefreshedAt: consumptionLastRefreshedAt,
    lastError: consumptionRefreshError,
  })
  const consumptionRefreshStatusText = getConsumptionRefreshStatusText({
    isLoading: consumptionLoading,
    refreshSource: consumptionRefreshSource,
    lastRefreshedAt: consumptionLastRefreshedAt,
    lastError: consumptionRefreshError,
  })
  const consumptionRefreshStatusBadgeClassName =
    consumptionRefreshStatus.tone === 'error'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : consumptionRefreshStatus.tone === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : consumptionRefreshStatus.tone === 'info'
          ? 'border-sky-200 bg-sky-50 text-sky-700'
          : 'border-slate-200 bg-slate-50 text-slate-500'
  const shellClassName =
    'rounded-[32px] border border-white/70 bg-white/75 shadow-[0_32px_120px_-48px_rgba(15,23,42,0.45)] backdrop-blur'
  const panelClassName =
    'rounded-[28px] border border-slate-200/70 bg-white/90 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.28)] backdrop-blur'
  const mutedPanelClassName =
    'rounded-[24px] border border-slate-200/80 bg-slate-50/85 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.25)]'
  const inputClassName =
    'w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100'
  const primaryButtonClassName =
    'inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/15 transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50'
  const successButtonClassName =
    'inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition hover:-translate-y-0.5 hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50'
  const dangerButtonClassName =
    'inline-flex items-center justify-center rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-500/20 transition hover:-translate-y-0.5 hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-50'
  const ghostButtonClassName =
    'inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 text-sm font-medium text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50'
  const warningButtonClassName =
    'inline-flex items-center justify-center rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-500/20 transition hover:-translate-y-0.5 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50'
  const compactInputClassName =
    'w-full rounded-2xl border border-slate-200 bg-white/95 px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 disabled:bg-slate-100 disabled:text-slate-500'
  const workspaceSummaryCardClassName =
    'rounded-[22px] border border-white/80 bg-white/80 px-4 py-4 shadow-sm'
  const filterFieldCardClassName =
    'rounded-[24px] border border-slate-200/80 bg-white/88 p-5 shadow-[0_18px_56px_-42px_rgba(15,23,42,0.28)]'
  const emptyStateClassName =
    'rounded-[24px] border border-dashed border-slate-200 bg-slate-50/75 px-6 py-10 text-center text-sm text-slate-500'
  const codeBlockClassName =
    'overflow-x-auto rounded-[22px] border border-slate-200/80 bg-slate-950 px-4 py-4 font-mono text-[12px] leading-6 text-slate-100 shadow-[0_18px_56px_-42px_rgba(15,23,42,0.55)]'
  const tableContainerClassName =
    'overflow-x-auto rounded-[24px] border border-slate-200/80 bg-white/95 shadow-[0_18px_56px_-42px_rgba(15,23,42,0.22)]'
  const paginationButtonClassName =
    'inline-flex h-10 min-w-[2.5rem] items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'
  const paginationActiveButtonClassName =
    'border-sky-500 bg-sky-500 text-white shadow-lg shadow-sky-500/20 hover:border-sky-500 hover:bg-sky-500'
  const inlineActionButtonClassName =
    'inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'
  const changePasswordSummaryCardThemeMap = {
    neutral: {
      panel:
        'border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))]',
      accent: 'bg-slate-400',
      value: 'text-slate-900',
    },
    success: {
      panel:
        'border-emerald-200/80 bg-[linear-gradient(180deg,rgba(236,253,245,0.96),rgba(255,255,255,0.94))]',
      accent: 'bg-emerald-500',
      value: 'text-emerald-900',
    },
    warning: {
      panel:
        'border-amber-200/80 bg-[linear-gradient(180deg,rgba(255,251,235,0.96),rgba(255,255,255,0.94))]',
      accent: 'bg-amber-500',
      value: 'text-amber-900',
    },
    danger: {
      panel:
        'border-rose-200/80 bg-[linear-gradient(180deg,rgba(255,241,242,0.96),rgba(255,255,255,0.94))]',
      accent: 'bg-rose-500',
      value: 'text-rose-900',
    },
  } as const
  const changePasswordChecklistToneMap = {
    true: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    false: 'border-slate-200 bg-slate-50 text-slate-500',
  } as const
  const systemConfigSummaryCardThemeMap = {
    配置项: {
      panel:
        'border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))]',
      accent: 'bg-slate-900',
      value: 'text-slate-900',
    },
    访问白名单: {
      panel:
        'border-sky-200/80 bg-[linear-gradient(180deg,rgba(240,249,255,0.96),rgba(255,255,255,0.94))]',
      accent: 'bg-sky-500',
      value: 'text-sky-900',
    },
    登录会话: {
      panel:
        'border-violet-200/80 bg-[linear-gradient(180deg,rgba(245,243,255,0.96),rgba(255,255,255,0.94))]',
      accent: 'bg-violet-500',
      value: 'text-violet-900',
    },
    密码强度: {
      panel:
        'border-emerald-200/80 bg-[linear-gradient(180deg,rgba(236,253,245,0.96),rgba(255,255,255,0.94))]',
      accent: 'bg-emerald-500',
      value: 'text-emerald-900',
    },
  } as const
  const systemConfigBadgeClassNameMap = {
    info: 'border-sky-200 bg-sky-50 text-sky-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    danger: 'border-rose-200 bg-rose-50 text-rose-600',
    neutral: 'border-slate-200 bg-slate-50 text-slate-600',
  } as const
  const systemConfigGroupThemeMap = {
    access: {
      panel: 'border-sky-200/80 bg-[linear-gradient(180deg,rgba(240,249,255,0.92),rgba(255,255,255,0.96))]',
      badge: 'bg-sky-100 text-sky-700',
      dot: 'bg-sky-500',
      title: 'text-sky-900',
      note: 'border-sky-200 bg-sky-50 text-sky-700',
      rail: 'from-sky-500 via-cyan-400 to-sky-200',
      divider: 'border-sky-100/80',
    },
    security: {
      panel: 'border-violet-200/80 bg-[linear-gradient(180deg,rgba(245,243,255,0.92),rgba(255,255,255,0.96))]',
      badge: 'bg-violet-100 text-violet-700',
      dot: 'bg-violet-500',
      title: 'text-violet-900',
      note: 'border-violet-200 bg-violet-50 text-violet-700',
      rail: 'from-violet-500 via-fuchsia-400 to-violet-200',
      divider: 'border-violet-100/80',
    },
    branding: {
      panel: 'border-amber-200/80 bg-[linear-gradient(180deg,rgba(255,251,235,0.92),rgba(255,255,255,0.96))]',
      badge: 'bg-amber-100 text-amber-700',
      dot: 'bg-amber-500',
      title: 'text-amber-900',
      note: 'border-amber-200 bg-amber-50 text-amber-700',
      rail: 'from-amber-400 via-yellow-300 to-amber-100',
      divider: 'border-amber-100/80',
    },
    advanced: {
      panel: 'border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.92),rgba(255,255,255,0.96))]',
      badge: 'bg-slate-100 text-slate-700',
      dot: 'bg-slate-500',
      title: 'text-slate-900',
      note: 'border-slate-200 bg-slate-50 text-slate-600',
      rail: 'from-slate-500 via-slate-300 to-slate-100',
      divider: 'border-slate-200/80',
    },
  } as const
  const togglePasswordFieldVisibility = (key: string) => {
    setRevealedPasswordFieldKeys((currentKeys) =>
      currentKeys.includes(key)
        ? currentKeys.filter((currentKey) => currentKey !== key)
        : [...currentKeys, key],
    )
  }
  const isPasswordFieldVisible = (key: string) => revealedPasswordFieldKeys.includes(key)
  const toggleSensitiveConfigVisibility = (key: string) => {
    setRevealedSensitiveConfigKeys((currentKeys) =>
      currentKeys.includes(key)
        ? currentKeys.filter((currentKey) => currentKey !== key)
        : [...currentKeys, key],
    )
  }
  const isSensitiveConfigVisible = (key: string) => revealedSensitiveConfigKeys.includes(key)

  const handleExportConsumptionLogs = () => {
    const params = buildConsumptionQueryParams(buildCurrentConsumptionFilters())
    const exportUrl = params.toString()
      ? `/api/admin/consumptions/export?${params.toString()}`
      : '/api/admin/consumptions/export'

    const link = document.createElement('a')
    link.setAttribute('href', exportUrl)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const applyConsumptionQuickRange = (createdFrom: string, createdTo: string) => {
    skipNextConsumptionAutoRefreshRef.current = true
    setConsumptionCreatedFrom(createdFrom)
    setConsumptionCreatedTo(createdTo)
    setConsumptionCurrentPage(1)
    void fetchConsumptionLogs({
      createdFrom,
      createdTo,
    }, 'quick')
  }

  const handleApplyConsumptionQuickRange = (rangeKey: 'today' | 'last7Days' | 'last30Days') => {
    const range = getConsumptionQuickRange(rangeKey)

    applyConsumptionQuickRange(range.createdFrom, range.createdTo)
  }

  const handleClearConsumptionTimeRange = () => {
    applyConsumptionQuickRange('', '')
  }

  const handleResetCodeFilters = () => {
    setSearchTerm('')
    setStatusFilter('all')
    setProjectFilter('all')
    setCardTypeFilter('all')
    setCurrentPage(1)
  }

  const handleResetConsumptionFilters = () => {
    skipNextConsumptionAutoRefreshRef.current = true
    setConsumptionSearchTerm('')
    setConsumptionProjectFilter('all')
    setConsumptionCreatedFrom('')
    setConsumptionCreatedTo('')
    setConsumptionCurrentPage(1)
    void fetchConsumptionLogs(
      {
        keyword: '',
        projectKey: 'all',
        createdFrom: '',
        createdTo: '',
      },
      'manual',
    )
  }

  const handleExportProjectStats = () => {
    const params = new URLSearchParams()

    if (statsProjectFilter !== 'all') {
      params.set('projectKey', statsProjectFilter)
    }

    const exportUrl = params.toString()
      ? `/api/admin/codes/stats/export?${params.toString()}`
      : '/api/admin/codes/stats/export'

    const link = document.createElement('a')
    link.setAttribute('href', exportUrl)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  useEffect(() => {
    const lastPage = Math.max(totalPages, 1)

    if (currentPage > lastPage) {
      setCurrentPage(lastPage)
    }
  }, [currentPage, totalPages])

  useEffect(() => {
    const lastPage = Math.max(consumptionTotalPages, 1)

    if (consumptionCurrentPage > lastPage) {
      setConsumptionCurrentPage(lastPage)
    }
  }, [consumptionCurrentPage, consumptionTotalPages])

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.14),transparent_28%),linear-gradient(180deg,#f8fbff_0%,#f6f8fc_42%,#eef2ff_100%)] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className={`${shellClassName} relative overflow-hidden p-6 sm:p-8`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.16),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.14),transparent_30%)]" />
          <div className="relative">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/70 bg-white/70 px-3 py-1 text-xs font-medium tracking-[0.18em] text-sky-700 shadow-sm backdrop-blur">
                  <span className="h-2 w-2 rounded-full bg-sky-500" />
                  当前模块 · {activeTabMeta.label}
                </div>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                  激活码管理后台
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                  {activeTabMeta.description}
                </p>
              </div>

              <button onClick={handleLogout} className={dangerButtonClassName}>
                登出
              </button>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
              {heroMetricCards.map((item) => (
                <div
                  key={item.label}
                  className="rounded-[24px] border border-white/80 bg-white/75 px-5 py-4 shadow-[0_18px_60px_-38px_rgba(15,23,42,0.3)] backdrop-blur"
                >
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</div>
                  <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{item.value}</div>
                  <div className="mt-2 text-sm text-slate-500">{item.description}</div>
                </div>
              ))}
            </div>

            <nav className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {dashboardTabs.map((tab) => {
                const isActive = activeTab === tab.key

                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`group rounded-[24px] border p-4 text-left transition ${
                      isActive
                        ? 'border-sky-200 bg-sky-50/85 shadow-[0_20px_60px_-40px_rgba(2,132,199,0.45)]'
                        : 'border-white/70 bg-white/65 hover:-translate-y-0.5 hover:border-slate-200 hover:bg-white/90'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold ${
                          isActive
                            ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20'
                            : 'bg-slate-900 text-white/90'
                        }`}
                      >
                        {tab.shortLabel}
                      </div>
                      <div className="min-w-0">
                        <div className={`text-sm font-semibold ${isActive ? 'text-sky-900' : 'text-slate-900'}`}>
                          {tab.label}
                        </div>
                        <div className={`mt-1 text-xs leading-6 ${isActive ? 'text-sky-700' : 'text-slate-500'}`}>
                          {tab.description}
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </nav>
          </div>
        </section>

        {message && (
          <div
            className={`rounded-[24px] border px-5 py-4 shadow-sm backdrop-blur ${
              messageType === 'success'
                ? 'border-emerald-200 bg-emerald-50/90 text-emerald-800'
                : 'border-rose-200 bg-rose-50/90 text-rose-800'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  messageType === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-500 text-white'
                }`}
              >
                {messageType === 'success' ? '✓' : '!'}
              </div>
              <div>
                <div className="text-sm font-semibold">
                  {messageType === 'success' ? '操作已完成' : '操作未完成'}
                </div>
                <div className="mt-1 text-sm">{message}</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3 rounded-[24px] border border-sky-200/70 bg-sky-50/85 px-5 py-4 text-sm text-sky-900 shadow-sm">
              <span className="inline-flex items-center rounded-full bg-sky-600/10 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-sky-700">
                当前统计口径
              </span>
              <span className="text-base font-semibold">{statsScopeLabel}</span>
              <span className="text-sky-700/80">顶部统计、消费趋势与导出都会跟随这个范围联动。</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-6">
              {statsCards.map((card) => (
                <div
                  key={card.label}
                  className="group relative overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_20px_60px_-36px_rgba(15,23,42,0.28)] transition hover:-translate-y-1 hover:shadow-[0_28px_90px_-40px_rgba(15,23,42,0.32)]"
                >
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 via-cyan-400 to-indigo-400 opacity-0 transition group-hover:opacity-100" />
                  <div className="flex items-center gap-4">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${card.color} shadow-lg shadow-slate-200`}>
                      <span className="text-base font-semibold text-white">{card.icon}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <dl>
                        <dt className="truncate text-sm font-medium text-slate-500">{card.label}</dt>
                        <dd className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{card.value}</dd>
                      </dl>
                      <p className="mt-2 text-xs text-slate-400">当前口径：{statsScopeLabel}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className={`${panelClassName} p-6`}>
                <div className="mb-5">
                  <h3 className="text-lg font-semibold text-slate-900">使用率统计</h3>
                  <p className="mt-1 text-sm text-slate-500">从全局发码视角观察已使用、过期和可用激活码分布。</p>
                </div>
                <div className="space-y-4">
                  {[
                    ['已使用', displayStats.used, 'bg-green-500'],
                    ['已过期', displayStats.expired, 'bg-red-500'],
                    ['可用', displayStats.active, 'bg-blue-500'],
                  ].map(([label, value, color]) => (
                    <div key={label} className={`${mutedPanelClassName} px-4 py-4`}>
                      <div className="mb-2 flex justify-between text-sm text-slate-600">
                        <span>{label}</span>
                        <span className="font-semibold text-slate-900">
                          {displayStats.total > 0 ? Math.round((Number(value) / displayStats.total) * 100) : 0}%
                        </span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-slate-200">
                        <div
                          className={`${color} h-2.5 rounded-full`}
                          style={{
                            width: `${displayStats.total > 0 ? (Number(value) / displayStats.total) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <div className="mt-2 text-xs text-slate-500">数量：{value} / {displayStats.total}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`${panelClassName} p-6`}>
                <div className="mb-5">
                  <h3 className="text-lg font-semibold text-slate-900">运营洞察</h3>
                  <p className="mt-1 text-sm text-slate-500">提炼当前项目范围内最值得关注的次数型使用信号。</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    ['次数使用率', countUsageRateText, countUsageRateDescription],
                    ['峰值消费项目', peakConsumptionProjectText, peakConsumptionProjectDescription],
                  ].map(([label, value, description]) => (
                    <div
                      key={String(label)}
                      className="rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(241,245,249,0.92))] px-5 py-5 shadow-[0_18px_48px_-40px_rgba(15,23,42,0.4)]"
                    >
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</div>
                      <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{value}</div>
                      <div className="mt-2 text-sm leading-6 text-slate-500">{description}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-lg shadow-lg">
              <div className="absolute inset-0 bg-slate-950" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.28),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.24),transparent_42%)]" />
              <div className="relative p-6 text-white">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold">消费趋势</h3>
                    <p className="text-sm text-blue-100/80">
                      {statsScopeLabel} · 最近 {consumptionTrendDays} 天{consumptionTrendGranularityLabel}消费趋势
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="inline-flex rounded-full bg-white/10 p-1">
                      {[7, 30].map((days) => (
                        <button
                          key={days}
                          type="button"
                          onClick={() => setConsumptionTrendDays(days as 7 | 30)}
                          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                            consumptionTrendDays === days
                              ? 'bg-white text-slate-900 shadow-sm'
                              : 'text-blue-100 hover:bg-white/10'
                          }`}
                        >
                          近 {days} 天
                        </button>
                      ))}
                    </div>

                    <select
                      value={consumptionTrendGranularity}
                      onChange={(e) =>
                        setConsumptionTrendGranularity(e.target.value as 'day' | 'week' | 'month')
                      }
                      className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-white outline-none backdrop-blur"
                    >
                      <option value="day" className="text-slate-900">按日</option>
                      <option value="week" className="text-slate-900">按周</option>
                      <option value="month" className="text-slate-900">按月</option>
                    </select>

                    <select
                      value={consumptionTrendCompareProjectKey}
                      onChange={(e) =>
                        setConsumptionTrendCompareProjectKey(e.target.value as 'none' | string)
                      }
                      className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-white outline-none backdrop-blur"
                    >
                      <option value="none" className="text-slate-900">不对比项目</option>
                      {availableConsumptionTrendCompareProjects.map((project) => (
                        <option key={project.id} value={project.projectKey} className="text-slate-900">
                          对比：{project.name}
                        </option>
                      ))}
                    </select>

                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-blue-50 backdrop-blur">
                      <input
                        type="checkbox"
                        checked={consumptionTrendHideZeroBuckets}
                        onChange={(e) => setConsumptionTrendHideZeroBuckets(e.target.checked)}
                        className="h-4 w-4 rounded border-white/20 bg-transparent text-cyan-300 focus:ring-cyan-300"
                      />
                      <span>仅显示非零桶</span>
                    </label>

                    <button
                      type="button"
                      onClick={handleExportConsumptionTrend}
                      className="rounded-full border border-emerald-300/30 bg-emerald-400/20 px-4 py-2 text-sm font-medium text-emerald-50 transition hover:bg-emerald-400/30"
                    >
                      导出趋势
                    </button>
                  </div>
                </div>

                <div className={`grid grid-cols-1 md:grid-cols-2 ${hasComparisonConsumptionTrend ? 'xl:grid-cols-6' : 'xl:grid-cols-4'} gap-4 mb-6`}>
                  {[
                    ['总扣次', consumptionTrend?.totalConsumptions ?? 0, '当前时间范围内的累计成功扣次'],
                    [consumptionTrendPeakLabel, consumptionTrendPeakValue, `当前${consumptionTrendGranularityLabel}时间桶内的最高消费次数`],
                    ['日均扣次', consumptionTrendAverage, '按当前时间范围均摊后的平均值'],
                    ['较上周期', consumptionTrendComparisonValue, consumptionTrendComparisonDescription],
                    ...(hasComparisonConsumptionTrend && selectedComparisonProject
                      ? [
                          [
                            '对比项目总扣次',
                            comparisonTrendTotalConsumptions,
                            `${selectedComparisonProject.name} 在相同时间范围内的累计成功扣次`,
                          ],
                          [
                            '项目差值',
                            comparisonTrendDifferenceText,
                            comparisonTrendDifferenceDescription,
                          ],
                        ]
                      : []),
                  ].map(([label, value, description]) => (
                    <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 backdrop-blur">
                      <div className="text-xs uppercase tracking-[0.18em] text-blue-100/60">{label}</div>
                      <div className="mt-3 text-3xl font-semibold text-white">{value}</div>
                      <div className="mt-2 text-xs text-blue-100/70">{description}</div>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  {consumptionTrendLoading ? (
                    <div className="flex h-72 items-center justify-center text-sm text-blue-100/80">
                      消费趋势加载中...
                    </div>
                  ) : consumptionTrendError ? (
                    <div className="flex h-72 items-center justify-center text-sm text-red-200">
                      {consumptionTrendError}
                    </div>
                  ) : consumptionTrend ? (
                    <div className="space-y-4">
                      {hasComparisonConsumptionTrend && selectedComparisonProject && (
                        <div className="flex flex-wrap items-center gap-4 text-xs text-blue-100/80">
                          <span className="inline-flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-cyan-300" />
                            <span>{statsScopeLabel}</span>
                          </span>
                          <span className="inline-flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-fuchsia-300" />
                            <span>{selectedComparisonProject.name}</span>
                          </span>
                        </div>
                      )}

                      {consumptionTrendCompareError && (
                        <div className="rounded-xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-50">
                          {consumptionTrendCompareError}
                        </div>
                      )}

                      {consumptionTrendHideZeroBuckets && hiddenZeroBucketCount > 0 && (
                        <div className="rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-50">
                          已隐藏 {hiddenZeroBucketCount} 个 0 扣次时间桶，仅影响图表展示，不影响顶部统计指标。
                        </div>
                      )}

                      {hasVisibleConsumptionTrendPoints ? (
                        hasComparisonConsumptionTrend && comparisonTrendSeries ? (
                          <div className="flex h-72 items-end gap-2">
                            {comparisonTrendSeries.points.map((point) => {
                              const primaryBarHeight =
                                consumptionTrendChartMaxCount > 0
                                  ? Math.max(
                                      (point.primaryCount / consumptionTrendChartMaxCount) * 100,
                                      point.primaryCount > 0 ? 14 : 4,
                                    )
                                  : 4
                              const secondaryBarHeight =
                                consumptionTrendChartMaxCount > 0
                                  ? Math.max(
                                      (point.secondaryCount / consumptionTrendChartMaxCount) * 100,
                                      point.secondaryCount > 0 ? 14 : 4,
                                    )
                                  : 4

                              return (
                                <div key={point.date} className="group flex min-w-0 flex-1 flex-col items-center gap-3">
                                  <div className="text-[11px] text-blue-100/75">
                                    {point.primaryCount} / {point.secondaryCount}
                                  </div>
                                  <div className="flex w-full flex-1 items-end justify-center gap-1">
                                    <div
                                      title={`${statsScopeLabel} · ${point.date}：${point.primaryCount} 次`}
                                      className={`w-full max-w-[16px] rounded-t-2xl border border-white/10 bg-gradient-to-t from-cyan-400 via-sky-400 to-indigo-300 shadow-[0_16px_40px_rgba(56,189,248,0.28)] transition-all duration-200 group-hover:brightness-110 ${
                                        point.primaryCount > 0 ? 'opacity-100' : 'opacity-40'
                                      }`}
                                      style={{ height: `${primaryBarHeight}%` }}
                                    />
                                    <div
                                      title={`${selectedComparisonProject?.name || '对比项目'} · ${point.date}：${point.secondaryCount} 次`}
                                      className={`w-full max-w-[16px] rounded-t-2xl border border-white/10 bg-gradient-to-t from-fuchsia-500 via-violet-400 to-purple-300 shadow-[0_16px_40px_rgba(217,70,239,0.24)] transition-all duration-200 group-hover:brightness-110 ${
                                        point.secondaryCount > 0 ? 'opacity-100' : 'opacity-40'
                                      }`}
                                      style={{ height: `${secondaryBarHeight}%` }}
                                    />
                                  </div>
                                  <div className="text-[11px] text-blue-100/70">{point.label}</div>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="flex h-72 items-end gap-2">
                            {visibleConsumptionTrendPoints.map((point) => {
                              const barHeight =
                                consumptionTrendChartMaxCount > 0
                                  ? Math.max(
                                      (point.count / consumptionTrendChartMaxCount) * 100,
                                      point.count > 0 ? 14 : 4,
                                    )
                                  : 4

                              return (
                                <div key={point.date} className="group flex min-w-0 flex-1 flex-col items-center gap-3">
                                  <div className="text-[11px] text-blue-100/75">{point.count}</div>
                                  <div className="flex w-full flex-1 items-end justify-center">
                                    <div
                                      title={`${point.date}：${point.count} 次`}
                                      className={`w-full max-w-[36px] rounded-t-2xl border border-white/10 bg-gradient-to-t from-cyan-400 via-sky-400 to-indigo-300 shadow-[0_16px_40px_rgba(56,189,248,0.28)] transition-all duration-200 group-hover:brightness-110 ${
                                        point.count > 0 ? 'opacity-100' : 'opacity-40'
                                      }`}
                                      style={{ height: `${barHeight}%` }}
                                    />
                                  </div>
                                  <div className="text-[11px] text-blue-100/70">{point.label}</div>
                                </div>
                              )
                            })}
                          </div>
                        )
                      ) : (
                        <div className="flex h-72 items-center justify-center text-sm text-blue-100/75">
                          暂无可展示的趋势时间桶
                        </div>
                      )}

                      {consumptionTrendHideZeroBuckets && !hasVisibleConsumptionTrendPoints ? (
                        <div className="rounded-xl border border-dashed border-white/10 bg-white/5 px-4 py-3 text-sm text-blue-100/75">
                          当前已隐藏所有零值时间桶，本时间范围暂无实际消费记录。你可以关闭该选项观察完整时间轴。
                        </div>
                      ) : !hasConsumptionTrendData && (
                        <div className="rounded-xl border border-dashed border-white/10 bg-white/5 px-4 py-3 text-sm text-blue-100/75">
                          当前时间范围暂无消费记录，可切换项目或扩大统计范围继续观察。
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex h-72 items-center justify-center text-sm text-blue-100/80">
                      暂无消费趋势数据
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className={`${panelClassName} p-6`}>
              <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">项目级统计</h3>
                  <p className="mt-1 text-sm text-slate-500">按项目查看发码、激活、有效、剩余次数与累计消耗。</p>
                </div>
                <div className="flex w-full max-w-2xl flex-col gap-3 md:flex-row md:items-end">
                  <div className="flex-1">
                    <label className="mb-2 block text-sm font-medium text-slate-700">项目筛选</label>
                    <select
                      value={statsProjectFilter}
                      onChange={(e) => setStatsProjectFilter(e.target.value)}
                      className={inputClassName}
                    >
                      <option value="all">全部项目</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.projectKey}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleExportProjectStats}
                    disabled={filteredProjectStats.length === 0}
                    className={successButtonClassName}
                  >
                    导出统计
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-[24px] border border-slate-200/80">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-slate-50/90">
                    <tr>
                      {[
                        '项目',
                        '项目标识',
                        '状态',
                        '总激活码',
                        '已激活',
                        '有效',
                        '已过期',
                        '次数剩余',
                        '次数消耗',
                      ].map((title) => (
                        <th
                          key={title}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          {title}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredProjectStats.map((project) => (
                      <tr key={project.id} className="transition hover:bg-slate-50/80">
                        <td className="px-6 py-4 text-sm font-medium text-slate-900">{project.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-500">{project.projectKey}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {project.isEnabled ? (
                            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">启用中</span>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">已停用</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{project.totalCodes}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{project.usedCodes}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{project.activeCodes}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{project.expiredCodes}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-700">{project.countRemainingTotal}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-700">{project.countConsumedTotal}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredProjectStats.length === 0 && (
                <div className="py-8 text-center text-gray-500">
                  {projectStats.length === 0 ? '暂无项目统计数据' : '暂无匹配的项目统计数据'}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'projects' && (
          <div className="space-y-6">
            <div className={`${panelClassName} relative overflow-hidden p-6 sm:p-7`}>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.1),transparent_30%)]" />
              <div className="relative">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div className="max-w-2xl">
                    <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-white/80 px-3 py-1 text-[11px] font-semibold tracking-[0.22em] text-sky-700 shadow-sm">
                      <span className="h-2 w-2 rounded-full bg-sky-500" />
                      项目工作区
                    </div>
                    <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
                      项目管理中心
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-slate-500 sm:text-base">
                      把新建项目和存量项目维护拆开处理，减少长页面滚动，也让搜索与编辑操作更聚焦。
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className={workspaceSummaryCardClassName}>
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">启用中</div>
                      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                        {enabledProjectsCount}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">当前可正常发码的项目</div>
                    </div>
                    <div className={workspaceSummaryCardClassName}>
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">已停用</div>
                      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                        {disabledProjectsCount}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">暂不允许继续发码的项目</div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {projectWorkspaceTabs.map((tab) => {
                    const isActive = projectWorkspaceTab === tab.key

                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setProjectWorkspaceTab(tab.key)}
                        className={`rounded-[24px] border p-4 text-left transition ${
                          isActive
                            ? 'border-sky-200 bg-sky-50/85 shadow-[0_20px_60px_-40px_rgba(2,132,199,0.35)]'
                            : 'border-white/70 bg-white/75 hover:-translate-y-0.5 hover:border-slate-200 hover:bg-white/90'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold ${
                              isActive
                                ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20'
                                : 'bg-slate-900 text-white/90'
                            }`}
                          >
                            {tab.shortLabel}
                          </div>
                          <div className="min-w-0">
                            <div className={`text-sm font-semibold ${isActive ? 'text-sky-900' : 'text-slate-900'}`}>
                              {tab.label}
                            </div>
                            <div className={`mt-1 text-xs leading-6 ${isActive ? 'text-sky-700' : 'text-slate-500'}`}>
                              {tab.description}
                            </div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {projectWorkspaceTab === 'create' && (
              <div className={`${panelClassName} p-6`}>
                <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900">新建项目</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      为不同产品或插件创建独立 projectKey，后续发码、统计和消费都能按项目隔离。
                    </p>
                  </div>
                  <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500">
                    创建后会自动出现在发码与筛选器中
                  </div>
                </div>

                <form onSubmit={handleCreateProject} className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                  <div className="rounded-[24px] border border-slate-200/80 bg-white/88 p-5 shadow-[0_18px_56px_-42px_rgba(15,23,42,0.28)]">
                    <label className="text-sm font-semibold text-slate-900">项目名称</label>
                    <p className="mt-2 text-sm leading-6 text-slate-500">面向管理员显示的主标题。</p>
                    <input
                      type="text"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      className={`${compactInputClassName} mt-4`}
                      placeholder="项目名称"
                      required
                    />
                  </div>
                  <div className="rounded-[24px] border border-slate-200/80 bg-white/88 p-5 shadow-[0_18px_56px_-42px_rgba(15,23,42,0.28)]">
                    <label className="text-sm font-semibold text-slate-900">项目标识</label>
                    <p className="mt-2 text-sm leading-6 text-slate-500">建议使用稳定的英文 key，例如 browser-plugin。</p>
                    <input
                      type="text"
                      value={newProjectKey}
                      onChange={(e) => setNewProjectKey(e.target.value)}
                      className={`${compactInputClassName} mt-4`}
                      placeholder="项目标识，例如 browser-plugin"
                      required
                    />
                  </div>
                  <div className="rounded-[24px] border border-slate-200/80 bg-white/88 p-5 shadow-[0_18px_56px_-42px_rgba(15,23,42,0.28)]">
                    <label className="text-sm font-semibold text-slate-900">项目描述</label>
                    <p className="mt-2 text-sm leading-6 text-slate-500">可选，用于补充当前项目的用途说明。</p>
                    <input
                      type="text"
                      value={newProjectDescription}
                      onChange={(e) => setNewProjectDescription(e.target.value)}
                      className={`${compactInputClassName} mt-4`}
                      placeholder="项目描述（可选）"
                    />
                  </div>
                  <div className="xl:col-span-3">
                    <div className="rounded-[26px] border border-slate-900/10 bg-slate-950/95 p-5 text-white shadow-[0_24px_64px_-42px_rgba(15,23,42,0.7)]">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <div className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-[0.22em] text-slate-200">
                            创建后立即可用
                          </div>
                          <h3 className="mt-3 text-base font-semibold text-white">准备创建新的项目空间？</h3>
                          <p className="mt-1 text-sm leading-6 text-slate-300">
                            新项目会立即出现在发码、统计和激活码筛选中，建议先确认 projectKey 命名稳定。
                          </p>
                        </div>
                        <button
                          type="submit"
                          disabled={loading}
                          className={`w-full lg:w-auto ${primaryButtonClassName}`}
                        >
                          {loading ? '创建中...' : '创建项目'}
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              </div>
            )}

            {projectWorkspaceTab === 'manage' && (
              <div className={`${panelClassName} p-6`}>
                <div className="mb-5 flex flex-col gap-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-slate-900">项目列表</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        当前匹配 {projectManagementPage.totalItems} / {projects.length} 个项目，可直接修改名称、描述和启停状态。
                      </p>
                    </div>
                    <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500">
                      默认项目名称固定，且不可停用
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">搜索项目</label>
                      <input
                        type="text"
                        value={projectManagementSearchTerm}
                        onChange={(e) => {
                          setProjectManagementSearchTerm(e.target.value)
                          setProjectManagementCurrentPage(1)
                        }}
                        className={compactInputClassName}
                        placeholder="项目名称 / projectKey / 描述"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">状态筛选</label>
                      <select
                        value={projectManagementStatusFilter}
                        onChange={(e) => {
                          setProjectManagementStatusFilter(e.target.value as ProjectManagementStatusFilter)
                          setProjectManagementCurrentPage(1)
                        }}
                        className={compactInputClassName}
                      >
                        <option value="all">全部状态</option>
                        <option value="enabled">仅启用中</option>
                        <option value="disabled">仅已停用</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">排序方式</label>
                      <select
                        value={projectManagementSortBy}
                        onChange={(e) => {
                          setProjectManagementSortBy(e.target.value as ProjectManagementSortOption)
                          setProjectManagementCurrentPage(1)
                        }}
                        className={compactInputClassName}
                      >
                        <option value="createdAtDesc">按创建时间（最新优先）</option>
                        <option value="createdAtAsc">按创建时间（最早优先）</option>
                        <option value="nameAsc">按项目名称（A-Z）</option>
                        <option value="nameDesc">按项目名称（Z-A）</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className={tableContainerClassName}>
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-slate-50/90">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">项目名称</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">项目标识</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">描述</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">状态</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {paginatedManageProjects.map((project) => (
                        <tr key={project.id} className="transition hover:bg-slate-50/80">
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={getProjectNameDraft(project)}
                                onChange={(e) => handleProjectNameChange(project.id, e.target.value)}
                                className={`${compactInputClassName} min-w-[180px]`}
                                placeholder="项目名称"
                                disabled={loading || project.projectKey === 'default'}
                              />
                              {project.projectKey === 'default' && (
                                <p className="text-xs text-gray-400">默认项目名称固定</p>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className="flex items-center gap-2">
                              <span className="font-mono">{project.projectKey}</span>
                              <button
                                onClick={() => void copyToClipboard(project.projectKey, '项目标识已复制')}
                                className={inlineActionButtonClassName}
                                disabled={loading}
                              >
                                复制
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            <input
                              type="text"
                              value={getProjectDescriptionDraft(project)}
                              onChange={(e) => handleProjectDescriptionChange(project.id, e.target.value)}
                              className={`${compactInputClassName} min-w-[220px]`}
                              placeholder="项目描述（可选）"
                              disabled={loading}
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {project.isEnabled ? (
                              <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800">启用中</span>
                            ) : (
                              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-800">已停用</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm font-medium">
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => void handleSaveProjectName(project)}
                                className={inlineActionButtonClassName}
                                disabled={loading || project.projectKey === 'default' || !hasProjectNameChanged(project)}
                              >
                                保存名称
                              </button>
                              <button
                                onClick={() => void handleSaveProjectDescription(project)}
                                className={inlineActionButtonClassName}
                                disabled={loading || !hasProjectDescriptionChanged(project)}
                              >
                                保存描述
                              </button>
                              <button
                                onClick={() => handleToggleProjectStatus(project)}
                                className={inlineActionButtonClassName}
                                disabled={loading || (project.projectKey === 'default' && project.isEnabled)}
                              >
                                {project.isEnabled ? '停用' : '启用'}
                              </button>
                              {project.projectKey !== 'default' && (
                                <button
                                  onClick={() => handleDeleteProject(project)}
                                  className={inlineActionButtonClassName}
                                  disabled={loading}
                                >
                                  删除
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {projectManagementPage.totalPages > 1 && (
                  <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="text-sm text-gray-700">
                      显示第 {projectManagementStartIndex} - {projectManagementEndIndex} 条，共 {projectManagementPage.totalItems} 条记录
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setProjectManagementCurrentPage(projectManagementPage.currentPage - 1)}
                        disabled={projectManagementPage.currentPage === 1}
                        className={paginationButtonClassName}
                      >
                        上一页
                      </button>
                      <div className="flex flex-wrap gap-2">
                        {Array.from({ length: projectManagementPage.totalPages }, (_, index) => index + 1).map((page) => (
                          <button
                            key={page}
                            onClick={() => setProjectManagementCurrentPage(page)}
                            className={`${paginationButtonClassName} ${
                              projectManagementPage.currentPage === page ? paginationActiveButtonClassName : ''
                            }`}
                          >
                            {page}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => setProjectManagementCurrentPage(projectManagementPage.currentPage + 1)}
                        disabled={projectManagementPage.currentPage === projectManagementPage.totalPages}
                        className={paginationButtonClassName}
                      >
                        下一页
                      </button>
                    </div>
                  </div>
                )}

                {projectManagementPage.totalItems === 0 && (
                  <div className="py-8 text-center text-gray-500">
                    {projects.length === 0 ? '暂无项目数据' : '暂无匹配的项目'}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'generate' && (
          <div className="space-y-6">
            <div className={`${panelClassName} p-6`}>
              <div className="mb-5">
                <h2 className="text-xl font-semibold text-slate-900">生成激活码</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  统一使用更圆润的表单样式，减少录入压迫感，同时保持时间卡与次数卡的生成流程清晰可读。
                </p>
              </div>

              <form onSubmit={handleGenerateCodes} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">所属项目</label>
                    <select
                      value={selectedProjectKey}
                      onChange={(e) => setSelectedProjectKey(e.target.value)}
                      className={compactInputClassName}
                    >
                      {projects.map((project) => (
                        <option key={project.id} value={project.projectKey} disabled={!project.isEnabled}>
                          {project.name} ({project.projectKey}){project.isEnabled ? '' : ' - 已停用'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">授权类型</label>
                    <select
                      value={licenseMode}
                      onChange={(e) => setLicenseMode(e.target.value as LicenseModeValue)}
                      className={compactInputClassName}
                    >
                      <option value="TIME">时间型</option>
                      <option value="COUNT">次数型</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">生成数量</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={amount}
                      onChange={(e) => setAmount(parseInt(e.target.value))}
                      className={compactInputClassName}
                      required
                    />
                  </div>
                </div>

                {licenseMode === 'TIME' ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">套餐类型</label>
                      <select
                        value={selectedCardType}
                        onChange={(e) => handleCardTypeChange(e.target.value)}
                        className={compactInputClassName}
                      >
                        <option value="">请选择套餐类型</option>
                        {cardTypes.map((cardType) => (
                          <option key={cardType.name} value={cardType.name}>
                            {cardType.name} ({cardType.description})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">有效期（天）</label>
                      <input
                        type="number"
                        min="1"
                        value={selectedCardType === '自定义' ? customDays : expiryDays}
                        onChange={(e) => {
                          const value = parseInt(e.target.value)
                          if (selectedCardType === '自定义') {
                            setCustomDays(value)
                          } else {
                            setExpiryDays(value)
                          }
                        }}
                        disabled={selectedCardType !== '自定义' && selectedCardType !== ''}
                        className={compactInputClassName}
                        required
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="submit"
                        disabled={loading}
                        className={`w-full ${primaryButtonClassName}`}
                      >
                        {loading ? '生成中...' : '生成时间型激活码'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">总次数</label>
                      <input
                        type="number"
                        min="1"
                        value={totalCount}
                        onChange={(e) => setTotalCount(parseInt(e.target.value))}
                        className={compactInputClassName}
                        required
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="submit"
                        disabled={loading}
                        className={`w-full ${primaryButtonClassName}`}
                      >
                        {loading ? '生成中...' : '生成次数型激活码'}
                      </button>
                    </div>
                  </div>
                )}
              </form>
            </div>

            {generatedCodes.length > 0 && (
              <div className={`${panelClassName} p-6`}>
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-xl font-semibold text-slate-900">本次生成的激活码</h2>
                  <button
                    onClick={() => exportCodes(generatedCodes)}
                    className={successButtonClassName}
                  >
                    导出CSV
                  </button>
                </div>

                <div className={tableContainerClassName}>
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-slate-50/90">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">项目</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">激活码</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">授权类型</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">规格</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">创建时间</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">剩余次数</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {generatedCodes.map((code) => (
                        <tr key={code.id} className="transition hover:bg-slate-50/80">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getProjectDisplay(code)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">{code.code}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getLicenseModeDisplay(code.licenseMode)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getSpecDisplay(code)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(code.createdAt).toLocaleString()}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getRemainingDisplay(code)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button onClick={() => void copyToClipboard(code.code)} className={inlineActionButtonClassName}>
                              复制
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'list' && (
          <div className="space-y-6">
            <div className={`${panelClassName} relative overflow-hidden p-6 sm:p-7`}>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.1),transparent_30%)]" />
              <div className="relative">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div className="max-w-2xl">
                    <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-white/80 px-3 py-1 text-[11px] font-semibold tracking-[0.22em] text-sky-700 shadow-sm">
                      <span className="h-2 w-2 rounded-full bg-sky-500" />
                      激活码工作区
                    </div>
                    <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
                      激活码管理中心
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-slate-500 sm:text-base">
                      把筛选器和结果列表拆开展示，避免搜索、导出、清理和分页全部挤在一个长页面里。
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className={workspaceSummaryCardClassName}>
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">当前匹配</div>
                      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                        {filteredCodes.length}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">筛选后的激活码记录总数</div>
                    </div>
                    <div className={workspaceSummaryCardClassName}>
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">覆盖项目</div>
                      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                        {activationCodeProjectCoverage}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">当前结果涉及的项目数</div>
                    </div>
                    <div className={workspaceSummaryCardClassName}>
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">风险项</div>
                      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                        {activationCodeStatusSummary.risk}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">已过期或已耗尽的记录</div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {activationCodeWorkspaceTabs.map((tab) => {
                    const isActive = activationCodeWorkspaceTab === tab.key

                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActivationCodeWorkspaceTab(tab.key)}
                        className={`rounded-[24px] border p-4 text-left transition ${
                          isActive
                            ? 'border-sky-200 bg-sky-50/85 shadow-[0_20px_60px_-40px_rgba(2,132,199,0.35)]'
                            : 'border-white/70 bg-white/75 hover:-translate-y-0.5 hover:border-slate-200 hover:bg-white/90'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xs font-semibold ${
                              isActive
                                ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20'
                                : 'bg-slate-900 text-white/90'
                            }`}
                          >
                            {tab.shortLabel}
                          </div>
                          <div className="min-w-0">
                            <div className={`text-sm font-semibold ${isActive ? 'text-sky-900' : 'text-slate-900'}`}>
                              {tab.label}
                            </div>
                            <div className={`mt-1 text-xs leading-6 ${isActive ? 'text-sky-700' : 'text-slate-500'}`}>
                              {tab.description}
                            </div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {activationCodeWorkspaceTab === 'filters' && (
              <div className={`${panelClassName} p-6`}>
                <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900">筛选与导出</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      统一维护搜索项、状态、项目与套餐条件，让输入区和搜索区保持同一套圆润卡片风格。
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleResetCodeFilters}
                      disabled={activationCodeFilterTokens.length === 0}
                      className={ghostButtonClassName}
                    >
                      重置筛选
                    </button>
                    <button
                      type="button"
                      onClick={() => setActivationCodeWorkspaceTab('results')}
                      className={primaryButtonClassName}
                    >
                      查看结果列表
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
                  <div className={filterFieldCardClassName}>
                    <label className="text-sm font-semibold text-slate-900">搜索激活码或机器ID</label>
                    <p className="mt-2 text-sm leading-6 text-slate-500">支持按激活码正文与绑定机器标识快速缩小范围。</p>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value)
                        setCurrentPage(1)
                      }}
                      className={`${compactInputClassName} mt-4`}
                      placeholder="输入激活码或机器ID"
                    />
                  </div>

                  <div className={filterFieldCardClassName}>
                    <label className="text-sm font-semibold text-slate-900">状态筛选</label>
                    <p className="mt-2 text-sm leading-6 text-slate-500">快速区分未激活、使用中、过期和次数耗尽状态。</p>
                    <select
                      value={statusFilter}
                      onChange={(e) => {
                        setStatusFilter(e.target.value as StatusFilter)
                        setCurrentPage(1)
                      }}
                      className={`${compactInputClassName} mt-4`}
                    >
                      <option value="all">全部状态</option>
                      <option value="unused">未激活</option>
                      <option value="used">已使用 / 使用中</option>
                      <option value="expired">已过期</option>
                      <option value="depleted">已耗尽</option>
                    </select>
                  </div>

                  <div className={filterFieldCardClassName}>
                    <label className="text-sm font-semibold text-slate-900">项目筛选</label>
                    <p className="mt-2 text-sm leading-6 text-slate-500">当你有多个项目时，可以只观察某一条业务线的发码结果。</p>
                    <select
                      value={projectFilter}
                      onChange={(e) => {
                        setProjectFilter(e.target.value)
                        setCurrentPage(1)
                      }}
                      className={`${compactInputClassName} mt-4`}
                    >
                      <option value="all">全部项目</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.projectKey}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={filterFieldCardClassName}>
                    <label className="text-sm font-semibold text-slate-900">套餐类型</label>
                    <p className="mt-2 text-sm leading-6 text-slate-500">适合将周卡、月卡、自定义天数与无套餐记录分别查看。</p>
                    <select
                      value={cardTypeFilter}
                      onChange={(e) => {
                        setCardTypeFilter(e.target.value)
                        setCurrentPage(1)
                      }}
                      className={`${compactInputClassName} mt-4`}
                    >
                      <option value="all">全部套餐</option>
                      {getAvailableCardTypes().map((cardType) => (
                        <option key={cardType} value={cardType}>
                          {cardType}
                        </option>
                      ))}
                      <option value="none">无套餐类型</option>
                    </select>
                  </div>

                  <div className={filterFieldCardClassName}>
                    <label className="text-sm font-semibold text-slate-900">导出当前结果</label>
                    <p className="mt-2 text-sm leading-6 text-slate-500">基于当前筛选条件导出 CSV，适合对账、转交和离线留档。</p>
                    <button
                      type="button"
                      onClick={() => exportCodes(filteredCodes)}
                      disabled={filteredCodes.length === 0}
                      className={`mt-4 w-full ${successButtonClassName}`}
                    >
                      导出筛选结果
                    </button>
                  </div>
                </div>

                <div className="mt-5 rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.94))] p-5 shadow-[0_18px_56px_-42px_rgba(15,23,42,0.22)]">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-3xl">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">当前生效条件</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {activationCodeFilterTokens.length > 0 ? (
                          activationCodeFilterTokens.map((token) => (
                            <span
                              key={token}
                              className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm text-sky-700"
                            >
                              {token}
                            </span>
                          ))
                        ) : (
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-500">
                            当前未设置任何筛选条件
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="rounded-[20px] border border-white/80 bg-white/90 px-4 py-4 shadow-sm">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-500">未激活</div>
                        <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                          {activationCodeStatusSummary.unused}
                        </div>
                      </div>
                      <div className="rounded-[20px] border border-white/80 bg-white/90 px-4 py-4 shadow-sm">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-500">已绑定</div>
                        <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                          {activationCodeStatusSummary.inUse}
                        </div>
                      </div>
                      <div className="rounded-[20px] border border-white/80 bg-white/90 px-4 py-4 shadow-sm">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-500">风险项</div>
                        <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                          {activationCodeStatusSummary.risk}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activationCodeWorkspaceTab === 'results' && (
              <div className={`${panelClassName} p-6`}>
                <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900">
                      激活码列表 ({filteredCodes.length} 条记录)
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      当前页聚焦查看结果、执行复制/删除/清理操作；筛选器被折叠到独立 tab，避免纵向滚动过长。
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setActivationCodeWorkspaceTab('filters')}
                      className={ghostButtonClassName}
                    >
                      查看筛选器
                    </button>
                    <button
                      type="button"
                      onClick={() => exportCodes(filteredCodes)}
                      disabled={filteredCodes.length === 0}
                      className={successButtonClassName}
                    >
                      导出筛选结果
                    </button>
                    <button
                      type="button"
                      onClick={handleCleanupExpired}
                      disabled={loading}
                      className={warningButtonClassName}
                    >
                      清理过期绑定
                    </button>
                  </div>
                </div>

                <div className="mb-5 rounded-[24px] border border-slate-200/80 bg-slate-50/85 px-5 py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap gap-2">
                      {activationCodeFilterTokens.length > 0 ? (
                        activationCodeFilterTokens.map((token) => (
                          <span
                            key={token}
                            className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm text-sky-700"
                          >
                            {token}
                          </span>
                        ))
                      ) : (
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-500">
                          当前显示全部激活码
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-slate-500">
                      当前展示第 {activationCodeStartIndex} - {activationCodeEndIndex} 条，共 {filteredCodes.length} 条记录
                    </div>
                  </div>
                </div>

                {loading ? (
                  <div className="py-10 text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
                    <p className="mt-2 text-slate-600">加载中...</p>
                  </div>
                ) : (
                  <>
                    <div className={tableContainerClassName}>
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-slate-50/90">
                          <tr>
                            {[
                              '项目',
                              '激活码',
                              '状态',
                              '授权类型',
                              '规格',
                              '创建时间',
                              '过期时间',
                              '剩余次数',
                              '使用时间',
                              '使用者',
                              '操作',
                            ].map((title) => (
                              <th
                                key={title}
                                className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                              >
                                {title}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {paginatedCodes.map((code) => (
                            <tr key={code.id} className="transition hover:bg-slate-50/80">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getProjectDisplay(code)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">{code.code}</td>
                              <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(code)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getLicenseModeDisplay(code.licenseMode)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getSpecDisplay(code)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(code.createdAt).toLocaleString()}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getExpiryDisplay(code)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getRemainingDisplay(code)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {code.usedAt ? new Date(code.usedAt).toLocaleString() : '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{code.usedBy || '-'}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <div className="flex flex-wrap gap-2">
                                  <button onClick={() => void copyToClipboard(code.code)} className={inlineActionButtonClassName}>
                                    复制
                                  </button>
                                  <button onClick={() => handleDeleteCode(code.id)} className={inlineActionButtonClassName}>
                                    删除
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {filteredCodes.length === 0 && (
                      <div className={`mt-5 ${emptyStateClassName}`}>
                        暂无匹配的激活码记录，建议切换到“筛选与导出”检查关键词、项目或套餐条件。
                      </div>
                    )}

                    {totalPages > 1 && (
                      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="text-sm text-gray-700">
                          显示第 {activationCodeStartIndex} - {activationCodeEndIndex} 条，共 {filteredCodes.length} 条记录
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => setCurrentPage(currentPage - 1)}
                            disabled={currentPage === 1}
                            className={paginationButtonClassName}
                          >
                            上一页
                          </button>
                          <div className="flex flex-wrap gap-2">
                            {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                              <button
                                key={page}
                                onClick={() => setCurrentPage(page)}
                                className={`${paginationButtonClassName} ${
                                  currentPage === page ? paginationActiveButtonClassName : ''
                                }`}
                              >
                                {page}
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={() => setCurrentPage(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className={paginationButtonClassName}
                          >
                            下一页
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'consumptions' && (
          <div className="space-y-6">
            <div className={`${panelClassName} relative overflow-hidden p-6 sm:p-7`}>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.1),transparent_30%)]" />
              <div className="relative">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div className="max-w-2xl">
                    <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-white/80 px-3 py-1 text-[11px] font-semibold tracking-[0.22em] text-sky-700 shadow-sm">
                      <span className="h-2 w-2 rounded-full bg-sky-500" />
                      消费日志工作区
                    </div>
                    <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
                      消费日志排查中心
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-slate-500 sm:text-base">
                      把筛选与刷新动作从日志结果页里拆出来，长表格只负责阅读与导出，避免搜索区压缩可视空间。
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className={workspaceSummaryCardClassName}>
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">匹配日志</div>
                      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                        {filteredConsumptionLogs.length}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">当前条件下的消费记录数</div>
                    </div>
                    <div className={workspaceSummaryCardClassName}>
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">涉及项目</div>
                      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                        {consumptionProjectCoverage}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">当前结果涉及的项目数</div>
                    </div>
                    <div className={workspaceSummaryCardClassName}>
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">涉及激活码</div>
                      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                        {consumptionCodeCoverage}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">当前结果覆盖的激活码数</div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {consumptionWorkspaceTabs.map((tab) => {
                    const isActive = consumptionWorkspaceTab === tab.key

                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setConsumptionWorkspaceTab(tab.key)}
                        className={`rounded-[24px] border p-4 text-left transition ${
                          isActive
                            ? 'border-sky-200 bg-sky-50/85 shadow-[0_20px_60px_-40px_rgba(2,132,199,0.35)]'
                            : 'border-white/70 bg-white/75 hover:-translate-y-0.5 hover:border-slate-200 hover:bg-white/90'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xs font-semibold ${
                              isActive
                                ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20'
                                : 'bg-slate-900 text-white/90'
                            }`}
                          >
                            {tab.shortLabel}
                          </div>
                          <div className="min-w-0">
                            <div className={`text-sm font-semibold ${isActive ? 'text-sky-900' : 'text-slate-900'}`}>
                              {tab.label}
                            </div>
                            <div className={`mt-1 text-xs leading-6 ${isActive ? 'text-sky-700' : 'text-slate-500'}`}>
                              {tab.description}
                            </div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {consumptionWorkspaceTab === 'filters' && (
              <div className={`${panelClassName} p-6`}>
                <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900">筛选与刷新</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      适合排查插件调用链路、幂等请求与真实扣次波动，所有筛选输入都统一到更圆润的卡片表单里。
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleResetConsumptionFilters}
                      disabled={consumptionFilterTokens.length === 0}
                      className={ghostButtonClassName}
                    >
                      重置筛选
                    </button>
                    <button
                      type="button"
                      onClick={() => setConsumptionWorkspaceTab('logs')}
                      className={primaryButtonClassName}
                    >
                      查看日志列表
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
                  <div className={filterFieldCardClassName}>
                    <label className="text-sm font-semibold text-slate-900">搜索 requestId / 机器ID / 激活码</label>
                    <p className="mt-2 text-sm leading-6 text-slate-500">适合追踪单次插件调用、设备异常与具体激活码的扣次链路。</p>
                    <input
                      type="text"
                      value={consumptionSearchTerm}
                      onChange={(e) => {
                        setConsumptionSearchTerm(e.target.value)
                        setConsumptionCurrentPage(1)
                      }}
                      className={`${compactInputClassName} mt-4`}
                      placeholder="输入 requestId、机器ID 或激活码"
                    />
                  </div>

                  <div className={filterFieldCardClassName}>
                    <label className="text-sm font-semibold text-slate-900">项目筛选</label>
                    <p className="mt-2 text-sm leading-6 text-slate-500">只看某一个项目时，更容易判断插件版本发布后的真实扣次波动。</p>
                    <select
                      value={consumptionProjectFilter}
                      onChange={(e) => {
                        setConsumptionProjectFilter(e.target.value)
                        setConsumptionCurrentPage(1)
                      }}
                      className={`${compactInputClassName} mt-4`}
                    >
                      <option value="all">全部项目</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.projectKey}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={filterFieldCardClassName}>
                    <label className="text-sm font-semibold text-slate-900">开始时间</label>
                    <p className="mt-2 text-sm leading-6 text-slate-500">用于圈定回溯窗口起点，适合配合错误工单或发布日期定位问题。</p>
                    <input
                      type="datetime-local"
                      value={consumptionCreatedFrom}
                      onChange={(e) => {
                        setConsumptionCreatedFrom(e.target.value)
                        setConsumptionCurrentPage(1)
                      }}
                      className={`${compactInputClassName} mt-4`}
                    />
                  </div>

                  <div className={filterFieldCardClassName}>
                    <label className="text-sm font-semibold text-slate-900">结束时间</label>
                    <p className="mt-2 text-sm leading-6 text-slate-500">与开始时间一起构成完整时间窗，避免长时间段日志对视线造成干扰。</p>
                    <input
                      type="datetime-local"
                      value={consumptionCreatedTo}
                      onChange={(e) => {
                        setConsumptionCreatedTo(e.target.value)
                        setConsumptionCurrentPage(1)
                      }}
                      className={`${compactInputClassName} mt-4`}
                    />
                  </div>

                  <div className={filterFieldCardClassName}>
                    <label className="text-sm font-semibold text-slate-900">刷新当前日志</label>
                    <p className="mt-2 text-sm leading-6 text-slate-500">立即按当前条件重新拉取，适合观察最新扣次或刚完成的线上操作。</p>
                    <button
                      type="button"
                      onClick={() => {
                        void fetchConsumptionLogs({}, 'manual')
                      }}
                      disabled={consumptionLoading}
                      className={`mt-4 w-full ${primaryButtonClassName}`}
                    >
                      {consumptionLoading ? '刷新中...' : '刷新消费日志'}
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[1.3fr_0.7fr]">
                  <div className="rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.94))] p-5 shadow-[0_18px_56px_-42px_rgba(15,23,42,0.22)]">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">快捷时间范围</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleApplyConsumptionQuickRange('today')}
                        className={ghostButtonClassName}
                      >
                        今天
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyConsumptionQuickRange('last7Days')}
                        className={ghostButtonClassName}
                      >
                        最近7天
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyConsumptionQuickRange('last30Days')}
                        className={ghostButtonClassName}
                      >
                        最近30天
                      </button>
                      <button
                        type="button"
                        onClick={handleClearConsumptionTimeRange}
                        className={ghostButtonClassName}
                      >
                        清空时间
                      </button>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {consumptionFilterTokens.length > 0 ? (
                        consumptionFilterTokens.map((token) => (
                          <span
                            key={token}
                            className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm text-sky-700"
                          >
                            {token}
                          </span>
                        ))
                      ) : (
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-500">
                          当前未设置任何筛选条件
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-slate-200/80 bg-white/92 p-5 shadow-[0_18px_56px_-42px_rgba(15,23,42,0.22)]">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">刷新状态</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm text-sky-700">
                        自动刷新已开启（{CONSUMPTION_AUTO_REFRESH_DELAY_MS}ms 防抖）
                      </span>
                      <span className={`rounded-full border px-3 py-1.5 text-sm ${consumptionRefreshStatusBadgeClassName}`}>
                        {consumptionRefreshStatusText}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleExportConsumptionLogs}
                      disabled={consumptionLoading || filteredConsumptionLogs.length === 0}
                      className={`mt-4 w-full ${successButtonClassName}`}
                    >
                      导出筛选结果
                    </button>
                  </div>
                </div>
              </div>
            )}

            {consumptionWorkspaceTab === 'logs' && (
              <div className={`${panelClassName} p-6`}>
                <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900">
                      消费日志 ({filteredConsumptionLogs.length} 条记录)
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      仅记录次数型激活码的真实扣次请求，适合用于对账与问题回溯；筛选器已独立成工作区，阅读时更聚焦。
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setConsumptionWorkspaceTab('filters')}
                      className={ghostButtonClassName}
                    >
                      查看筛选器
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void fetchConsumptionLogs({}, 'manual')
                      }}
                      disabled={consumptionLoading}
                      className={primaryButtonClassName}
                    >
                      {consumptionLoading ? '刷新中...' : '刷新消费日志'}
                    </button>
                    <button
                      type="button"
                      onClick={handleExportConsumptionLogs}
                      disabled={consumptionLoading || filteredConsumptionLogs.length === 0}
                      className={successButtonClassName}
                    >
                      导出筛选结果
                    </button>
                  </div>
                </div>

                <div className="mb-5 rounded-[24px] border border-slate-200/80 bg-slate-50/85 px-5 py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm text-sky-700">
                        自动刷新已开启（{CONSUMPTION_AUTO_REFRESH_DELAY_MS}ms 防抖）
                      </span>
                      <span className={`rounded-full border px-3 py-1.5 text-sm ${consumptionRefreshStatusBadgeClassName}`}>
                        {consumptionRefreshStatusText}
                      </span>
                      {consumptionFilterTokens.length > 0 ? (
                        consumptionFilterTokens.map((token) => (
                          <span
                            key={token}
                            className="rounded-full border border-sky-200 bg-white px-3 py-1.5 text-sm text-slate-600"
                          >
                            {token}
                          </span>
                        ))
                      ) : (
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-500">
                          当前显示全部消费日志
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-slate-500">
                      当前展示第 {consumptionStartIndex} - {consumptionEndIndex} 条，共 {filteredConsumptionLogs.length} 条记录
                    </div>
                  </div>
                </div>

                {consumptionLoading ? (
                  <div className="py-10 text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
                    <p className="mt-2 text-slate-600">{consumptionRefreshStatusText}</p>
                  </div>
                ) : (
                  <>
                    <div className={tableContainerClassName}>
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-slate-50/90">
                          <tr>
                            {[
                              '项目',
                              '激活码',
                              'requestId',
                              '机器ID',
                              '授权类型',
                              '剩余次数',
                              '消费时间',
                            ].map((title) => (
                              <th
                                key={title}
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                              >
                                {title}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {paginatedConsumptionLogs.map((log) => (
                            <tr key={log.id} className="transition hover:bg-slate-50/80">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-700">
                                {log.activationCode.project.name}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-900">
                                {log.activationCode.code}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-500">
                                {log.requestId}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{log.machineId}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                {getLicenseModeDisplay(log.activationCode.licenseMode)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-700">
                                {log.remainingCountAfter}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                {new Date(log.createdAt).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {filteredConsumptionLogs.length === 0 && (
                      <div className={`mt-5 ${emptyStateClassName}`}>
                        暂无匹配的消费日志，建议切换到“筛选与刷新”调整关键词、项目或时间范围。
                      </div>
                    )}

                    {consumptionTotalPages > 1 && (
                      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="text-sm text-gray-700">
                          显示第 {consumptionStartIndex} - {consumptionEndIndex} 条，共 {filteredConsumptionLogs.length} 条记录
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => setConsumptionCurrentPage(consumptionCurrentPage - 1)}
                            disabled={consumptionCurrentPage === 1}
                            className={paginationButtonClassName}
                          >
                            上一页
                          </button>
                          <div className="flex flex-wrap gap-2">
                            {Array.from({ length: consumptionTotalPages }, (_, index) => index + 1).map((page) => (
                              <button
                                key={page}
                                onClick={() => setConsumptionCurrentPage(page)}
                                className={`${paginationButtonClassName} ${
                                  consumptionCurrentPage === page ? paginationActiveButtonClassName : ''
                                }`}
                              >
                                {page}
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={() => setConsumptionCurrentPage(consumptionCurrentPage + 1)}
                            disabled={consumptionCurrentPage === consumptionTotalPages}
                            className={paginationButtonClassName}
                          >
                            下一页
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'apiDocs' && (
          <ApiDocsWorkspace mode="dashboard" onFeedback={showMessage} />
        )}

        {activeTab === 'changePassword' && (
          <div className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
              <div className={`${panelClassName} relative overflow-hidden p-6 sm:p-7`}>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.12),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.12),transparent_28%)]" />
                <div className="relative">
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-white/80 px-3 py-1 text-[11px] font-semibold tracking-[0.22em] text-emerald-700 shadow-sm">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    凭证安全
                  </div>

                  <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-2xl">
                      <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                        管理员密码工作台
                      </h2>
                      <p className="mt-2 text-sm leading-7 text-slate-500 sm:text-base">
                        在修改前先完成实时检查，确保新密码可用、可记忆，并符合后台最基本的安全要求。
                      </p>
                    </div>

                    <div className="rounded-[22px] border border-white/80 bg-white/80 px-4 py-4 text-sm leading-6 text-slate-600 shadow-[0_18px_56px_-42px_rgba(15,23,42,0.28)]">
                      已完成 <span className="font-semibold text-slate-900">{completedPasswordChecklistCount}</span> /{' '}
                      {changePasswordPageModel.checklist.length} 项安全检查。
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {changePasswordPageModel.summaryCards.map((card) => {
                      const summaryCardTheme = changePasswordSummaryCardThemeMap[card.tone]

                      return (
                        <div
                          key={card.label}
                          className={`relative overflow-hidden rounded-[24px] border px-5 py-5 shadow-[0_18px_56px_-42px_rgba(15,23,42,0.3)] ${summaryCardTheme.panel}`}
                        >
                          <div className={`absolute inset-x-5 top-0 h-1 rounded-full ${summaryCardTheme.accent}`} />
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                            {card.label}
                          </div>
                          <div className={`mt-3 text-3xl font-semibold tracking-tight ${summaryCardTheme.value}`}>
                            {card.value}
                          </div>
                          <div className="mt-2 text-sm leading-6 text-slate-500">{card.description}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className={`${panelClassName} relative overflow-hidden border-emerald-100 bg-[linear-gradient(180deg,rgba(240,253,244,0.96),rgba(255,255,255,0.94))] p-6`}>
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-sky-400 to-indigo-400" />
                <div className="relative">
                  <div className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-emerald-700">
                    修改后行为
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-900">完成后会立即触发这些变化</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    密码修改属于即时生效操作，建议在一个稳定的网络环境下完成。
                  </p>

                  <div className="mt-5 space-y-3">
                    {[
                      '后台会先校验当前密码，只有验证通过后才会写入新的管理员凭据。',
                      '新密码会按系统当前 bcrypt 轮数重新哈希，安全成本与系统配置保持一致。',
                      '修改成功后会在 3 秒内自动登出，方便让所有旧会话失效并重新验证。',
                    ].map((tip, index) => (
                      <div
                        key={tip}
                        className="flex items-start gap-3 rounded-[22px] border border-white/80 bg-white/80 px-4 py-4 text-sm leading-7 text-slate-600 shadow-sm"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-xs font-semibold text-white shadow-sm">
                          0{index + 1}
                        </div>
                        <div>{tip}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-[22px] border border-white/80 bg-white/80 px-4 py-4 shadow-sm">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">自动登出</div>
                      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">3 秒</div>
                      <div className="mt-1 text-sm text-slate-500">修改成功后的安全退出窗口</div>
                    </div>
                    <div className="rounded-[22px] border border-white/80 bg-white/80 px-4 py-4 shadow-sm">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">最低长度</div>
                      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">6 位</div>
                      <div className="mt-1 text-sm text-slate-500">接口层当前要求的最小值</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
              <form onSubmit={handleChangePassword} className={`${panelClassName} relative overflow-hidden p-6`}>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.1),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.08),transparent_26%)]" />
                <div className="relative">
                  <div className="mb-5">
                    <div className="inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-slate-700">
                      更新凭据
                    </div>
                    <h3 className="mt-4 text-xl font-semibold text-slate-900">修改管理员密码</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      建议使用至少 10 位、包含数字与符号的新密码，以降低后台被撞库和弱口令命中的风险。
                    </p>
                  </div>

                  <div className="space-y-4">
                    {[
                      {
                        key: 'currentPassword',
                        label: '当前密码',
                        description: '用于验证当前操作者身份。',
                        value: currentPassword,
                        onChange: setCurrentPassword,
                        placeholder: '请输入当前密码',
                        autoComplete: 'current-password',
                        minLength: undefined,
                      },
                      {
                        key: 'newPassword',
                        label: '新密码',
                        description: '建议至少 10 位，并加入数字与符号。',
                        value: newPassword,
                        onChange: setNewPassword,
                        placeholder: '请输入新密码（至少6位）',
                        autoComplete: 'new-password',
                        minLength: 6,
                      },
                      {
                        key: 'confirmPassword',
                        label: '确认新密码',
                        description: '再次输入新密码，避免误保存。',
                        value: confirmPassword,
                        onChange: setConfirmPassword,
                        placeholder: '请再次输入新密码',
                        autoComplete: 'new-password',
                        minLength: 6,
                      },
                    ].map((field) => (
                      <div
                        key={field.key}
                        className="rounded-[24px] border border-slate-200/80 bg-white/88 p-5 shadow-[0_18px_56px_-42px_rgba(15,23,42,0.35)] backdrop-blur"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <label
                              htmlFor={field.key}
                              className="text-base font-semibold text-slate-900"
                            >
                              {field.label}
                            </label>
                            <p className="mt-2 text-sm leading-6 text-slate-500">
                              {field.description}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => togglePasswordFieldVisibility(field.key)}
                            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                          >
                            {isPasswordFieldVisible(field.key) ? '隐藏内容' : '显示内容'}
                          </button>
                        </div>

                        <div className="mt-4">
                          <input
                            type={isPasswordFieldVisible(field.key) ? 'text' : 'password'}
                            id={field.key}
                            value={field.value}
                            onChange={(e) => field.onChange(e.target.value)}
                            className={inputClassName}
                            placeholder={field.placeholder}
                            required
                            minLength={field.minLength}
                            autoComplete={field.autoComplete}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 rounded-[26px] border border-slate-900/10 bg-slate-950/95 p-5 text-white shadow-[0_24px_64px_-42px_rgba(15,23,42,0.7)]">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-[0.22em] text-slate-200">
                          确认后立即生效
                        </div>
                        <h3 className="mt-3 text-base font-semibold text-white">准备提交本次密码变更？</h3>
                        <p className="mt-1 text-sm leading-6 text-slate-300">
                          修改成功后系统会提示重新登录，并在 3 秒内自动退出当前会话。
                        </p>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-slate-950/30 transition hover:-translate-y-0.5 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
                      >
                        {loading ? '修改中...' : '修改密码'}
                      </button>
                    </div>
                  </div>
                </div>
              </form>

              <div className="space-y-6">
                <div className={`${panelClassName} p-6`}>
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                      <div className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-sky-700">
                        实时校验
                      </div>
                      <h3 className="mt-4 text-lg font-semibold text-slate-900">当前密码安全检查</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        输入时会即时反馈关键检查项，减少提交后报错的来回成本。
                      </p>
                    </div>

                    <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">
                      {completedPasswordChecklistCount} / {changePasswordPageModel.checklist.length} 已通过
                    </div>
                  </div>

                  <div className="space-y-3">
                    {changePasswordPageModel.checklist.map((item) => (
                      <div
                        key={item.key}
                        className={`flex items-start gap-3 rounded-[22px] border px-4 py-4 ${changePasswordChecklistToneMap[String(item.satisfied) as 'true' | 'false']}`}
                      >
                        <div
                          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold ${
                            item.satisfied ? 'bg-emerald-600 text-white' : 'bg-white text-slate-400'
                          }`}
                        >
                          {item.satisfied ? '✓' : '·'}
                        </div>
                        <div>
                          <div className="text-sm font-semibold">{item.label}</div>
                          <div className="mt-1 text-sm leading-6 opacity-90">{item.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={`${panelClassName} relative overflow-hidden border-violet-100 bg-[linear-gradient(180deg,rgba(245,243,255,0.96),rgba(255,255,255,0.94))] p-6`}>
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.12),transparent_30%)]" />
                  <div className="relative">
                    <div className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-violet-700">
                      安全建议
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-slate-900">给管理员密码留一点冗余</h3>
                    <div className="mt-4 grid gap-3">
                      {[
                        '优先使用“词组 + 数字 + 符号”的组合，既更强也更容易记忆。',
                        '避免复用项目 key、公司名、手机号等容易被猜中的信息。',
                        '如在多人环境共用后台，建议定期轮换管理员密码并缩短会话时长。',
                      ].map((tip) => (
                        <div
                          key={tip}
                          className="rounded-[22px] border border-white/80 bg-white/80 px-4 py-4 text-sm leading-7 text-slate-600 shadow-sm"
                        >
                          {tip}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'systemConfig' && (
          <div className="space-y-6 pb-10">
            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <div className={`${panelClassName} relative overflow-hidden p-6 sm:p-7`}>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.12),transparent_30%)]" />
                <div className="relative">
                  <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-white/80 px-3 py-1 text-[11px] font-semibold tracking-[0.22em] text-sky-700 shadow-sm">
                    <span className="h-2 w-2 rounded-full bg-sky-500" />
                    配置工作台
                  </div>

                  <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-2xl">
                      <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                        系统配置中心
                      </h2>
                      <p className="mt-2 text-sm leading-7 text-slate-500 sm:text-base">
                        把访问控制、登录安全和系统展示统一放进一个更清晰、更有层次的配置工作台。
                      </p>
                    </div>

                    <div className="rounded-[22px] border border-white/80 bg-white/80 px-4 py-4 text-sm leading-6 text-slate-600 shadow-[0_18px_56px_-42px_rgba(15,23,42,0.28)]">
                      已归纳为 <span className="font-semibold text-slate-900">{systemConfigPageModel.groups.length}</span>{' '}
                      个配置分区，保存后会立即写入系统配置表。
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {systemConfigPageModel.summaryCards.map((card) => {
                      const summaryCardTheme =
                        systemConfigSummaryCardThemeMap[
                          card.label as keyof typeof systemConfigSummaryCardThemeMap
                        ] || systemConfigSummaryCardThemeMap.配置项

                      return (
                        <div
                          key={card.label}
                          className={`group relative overflow-hidden rounded-[24px] border px-5 py-5 shadow-[0_18px_56px_-42px_rgba(15,23,42,0.3)] transition hover:-translate-y-0.5 ${summaryCardTheme.panel}`}
                        >
                          <div className={`absolute inset-x-5 top-0 h-1 rounded-full ${summaryCardTheme.accent}`} />
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{card.label}</div>
                          <div
                            className={`mt-3 text-3xl font-semibold tracking-tight ${summaryCardTheme.value}`}
                          >
                            {card.value}
                          </div>
                          <div className="mt-2 text-sm leading-6 text-slate-500">
                            {card.description}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className={`${panelClassName} relative overflow-hidden border-violet-100 bg-[linear-gradient(180deg,rgba(250,245,255,0.96),rgba(255,255,255,0.94))] p-6`}>
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 via-fuchsia-400 to-sky-400" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.12),transparent_30%)]" />
                <div className="relative">
                  <div className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-violet-700">
                    变更前提示
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-900">先确认这些关键影响</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    配置页里所有更改都属于即时生效型操作，建议先从影响面最大的项开始检查。
                  </p>

                  <div className="mt-5 space-y-3">
                    {[
                      '修改 JWT 密钥后，当前所有管理员会话都需要重新登录。',
                      '调整 IP 白名单前，请确认当前访问 IP 已被包含，避免把自己锁在系统外。',
                      '提升 bcrypt 轮数会增强安全性，但登录与改密耗时也会增加。',
                    ].map((tip, index) => (
                      <div
                        key={tip}
                        className="flex items-start gap-3 rounded-[22px] border border-white/80 bg-white/75 px-4 py-4 text-sm leading-7 text-slate-600 shadow-sm backdrop-blur"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-xs font-semibold text-white shadow-sm">
                          0{index + 1}
                        </div>
                        <div>{tip}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-[22px] border border-white/80 bg-white/80 px-4 py-4 shadow-sm">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">敏感项</div>
                      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                        {systemConfigSensitiveCount}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">涉及会话或凭证配置</div>
                    </div>
                    <div className="rounded-[22px] border border-white/80 bg-white/80 px-4 py-4 shadow-sm">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">白名单地址</div>
                      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                        {systemConfigWhitelistEntryCount}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">当前允许访问后台的来源</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {loading && systemConfigs.length === 0 ? (
              <div className={`${panelClassName} p-10 text-center`}>
                <div className="inline-block h-9 w-9 animate-spin rounded-full border-b-2 border-sky-600" />
                <p className="mt-3 text-sm text-slate-500">正在加载系统配置...</p>
              </div>
            ) : systemConfigPageModel.groups.length === 0 ? (
              <div className={`${panelClassName} p-10 text-center text-slate-500`}>
                暂无系统配置数据
              </div>
            ) : (
              <form onSubmit={handleUpdateSystemConfig} className="space-y-6">
                {systemConfigPageModel.groups.map((group) => {
                  const groupTheme = systemConfigGroupThemeMap[group.key]

                  return (
                    <section
                      key={group.key}
                      className={`${panelClassName} ${groupTheme.panel} relative overflow-hidden`}
                    >
                      <div className={`absolute inset-y-6 left-0 w-1 rounded-full bg-gradient-to-b ${groupTheme.rail}`} />
                      <div className="grid gap-0 xl:grid-cols-[280px_minmax(0,1fr)]">
                        <div className={`border-b px-6 py-6 xl:border-b-0 xl:border-r ${groupTheme.divider}`}>
                          <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold tracking-[0.18em] ${groupTheme.badge}`}>
                            <span className={`h-2 w-2 rounded-full ${groupTheme.dot}`} />
                            {group.badge}
                          </div>
                          <h3 className={`mt-4 text-xl font-semibold tracking-tight ${groupTheme.title}`}>
                            {group.title}
                          </h3>
                          <p className="mt-2 text-sm leading-7 text-slate-500">{group.description}</p>

                          <div className="mt-5 flex flex-wrap gap-2">
                            <span className="rounded-full border border-white/80 bg-white/85 px-3 py-1.5 text-xs font-medium text-slate-500 shadow-sm">
                              {group.items.length} 项配置
                            </span>
                            <span className="rounded-full border border-white/80 bg-white/85 px-3 py-1.5 text-xs font-medium text-slate-500 shadow-sm">
                              {group.items.filter((item) => item.sensitive).length} 个敏感项
                            </span>
                          </div>
                        </div>

                        <div className="p-6">
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            {group.items.map((item) => (
                              <article
                                key={item.key}
                                className={`group relative overflow-hidden rounded-[26px] border border-white/85 bg-white/92 p-5 shadow-[0_18px_56px_-42px_rgba(15,23,42,0.35)] backdrop-blur transition hover:-translate-y-0.5 hover:shadow-[0_24px_64px_-42px_rgba(15,23,42,0.38)] ${
                                  item.layout === 'full' ? 'md:col-span-2' : ''
                                }`}
                              >
                                <div className={`absolute inset-x-5 top-0 h-px bg-gradient-to-r ${groupTheme.rail} opacity-80`} />

                                <div className="relative">
                                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <h4 className="text-base font-semibold text-slate-900">
                                          {item.label}
                                        </h4>
                                        {item.badges?.map((badge) => (
                                          <span
                                            key={`${item.key}-${badge.label}`}
                                            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${systemConfigBadgeClassNameMap[badge.tone]}`}
                                          >
                                            {badge.label}
                                          </span>
                                        ))}
                                      </div>
                                      <p className="mt-2 text-sm leading-6 text-slate-500">
                                        {item.description}
                                      </p>
                                    </div>

                                    {item.sensitive && (
                                      <button
                                        type="button"
                                        onClick={() => toggleSensitiveConfigVisibility(item.key)}
                                        className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                                      >
                                        {isSensitiveConfigVisible(item.key) ? '隐藏内容' : '显示内容'}
                                      </button>
                                    )}
                                  </div>

                                  <div className="mt-4 space-y-4">
                                    {item.inputKind === 'textarea' ? (
                                      <textarea
                                        value={Array.isArray(item.value) ? item.value.join('\n') : String(item.value || '')}
                                        onChange={(e) => {
                                          const ips = e.target.value
                                            .split('\n')
                                            .map((ip) => ip.trim())
                                            .filter(Boolean)
                                          updateConfigValue(item.key, ips)
                                        }}
                                        className={`${inputClassName} min-h-[152px] resize-y`}
                                        rows={5}
                                        placeholder={item.placeholder}
                                      />
                                    ) : item.inputKind === 'number' ? (
                                      <input
                                        type="number"
                                        min="4"
                                        max="15"
                                        value={item.value}
                                        onChange={(e) => {
                                          const nextValue = Number.parseInt(e.target.value, 10)
                                          updateConfigValue(item.key, Number.isNaN(nextValue) ? 4 : nextValue)
                                        }}
                                        className={inputClassName}
                                      />
                                    ) : item.inputKind === 'select' ? (
                                      <select
                                        value={String(item.value)}
                                        onChange={(e) => updateConfigValue(item.key, e.target.value)}
                                        className={inputClassName}
                                      >
                                        {item.options?.map((option) => (
                                          <option key={option.value} value={option.value}>
                                            {option.label}
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      <input
                                        type={
                                          item.inputKind === 'password'
                                            ? (isSensitiveConfigVisible(item.key) ? 'text' : 'password')
                                            : 'text'
                                        }
                                        value={String(item.value ?? '')}
                                        onChange={(e) => updateConfigValue(item.key, e.target.value)}
                                        className={`${inputClassName} ${
                                          item.sensitive ? 'font-mono tracking-[0.08em]' : ''
                                        }`}
                                        placeholder={item.placeholder}
                                      />
                                    )}

                                    {item.previewTokens && (
                                      <div className="rounded-[20px] border border-white/80 bg-white/82 p-4 shadow-sm">
                                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                          当前白名单预览
                                        </div>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                          {item.previewTokens.length > 0 ? (
                                            item.previewTokens.map((token) => (
                                              <span
                                                key={`${item.key}-${token}`}
                                                className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700"
                                              >
                                                {token}
                                              </span>
                                            ))
                                          ) : (
                                            <span className="rounded-full border border-dashed border-slate-200 px-3 py-1.5 text-xs text-slate-400">
                                              尚未填写 IP 地址
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  <div className={`mt-4 rounded-[20px] border px-4 py-3 ${groupTheme.note}`}>
                                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">
                                      操作建议
                                    </div>
                                    <div className="text-sm leading-6">{item.hint}</div>
                                  </div>
                                </div>
                              </article>
                            ))}
                          </div>
                        </div>
                      </div>
                    </section>
                  )
                })}

                <div className="relative">
                  <div className="relative overflow-hidden rounded-[28px] border border-slate-900/10 bg-slate-950/95 p-5 text-white shadow-[0_32px_90px_-48px_rgba(15,23,42,0.7)] backdrop-blur">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.18),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.16),transparent_34%)]" />
                    <div className="relative flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                      <div>
                        <div className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-[0.22em] text-slate-200">
                          保存后立即生效
                        </div>
                        <h3 className="mt-3 text-lg font-semibold text-white">准备保存本次配置变更？</h3>
                        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-300">
                          保存后会立即写入系统配置表；涉及认证与白名单的变更会立刻影响后台访问行为。
                        </p>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-200">
                            {systemConfigs.length} 项配置
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-200">
                            {systemConfigSensitiveCount} 个敏感项
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-200">
                            {systemConfigWhitelistEntryCount} 个白名单地址
                          </span>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-slate-950/30 transition hover:-translate-y-0.5 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
                      >
                        {loading ? '保存中...' : '保存配置'}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
