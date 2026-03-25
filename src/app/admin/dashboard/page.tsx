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
  consumptionWorkspaceTabs,
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
import {
  getProjectKeyValidationError,
  normalizeProjectKeyInput,
} from '@/lib/project-key'
import { ApiDocsWorkspace } from '@/components/api-docs-workspace'
import { ActivationCodeWorkspace } from '@/components/activation-code-workspace'
import { ChangePasswordWorkspace } from '@/components/change-password-workspace'
import { ConsumptionWorkspace } from '@/components/consumption-workspace'
import { DashboardActionPanel } from '@/components/dashboard-action-panel'
import { DashboardDataTable } from '@/components/dashboard-data-table'
import { DashboardEmptyState } from '@/components/dashboard-empty-state'
import { DashboardFilterFieldCard } from '@/components/dashboard-filter-field-card'
import { DashboardFormField } from '@/components/dashboard-form-field'
import { DashboardInlineActionButton } from '@/components/dashboard-inline-action-button'
import { DashboardLoadingState } from '@/components/dashboard-loading-state'
import { DashboardPaginationBar } from '@/components/dashboard-pagination-bar'
import { DashboardSectionHeader } from '@/components/dashboard-section-header'
import { DashboardStatusBadge } from '@/components/dashboard-status-badge'
import { DashboardSubmitField } from '@/components/dashboard-submit-field'
import { DashboardSummaryStrip } from '@/components/dashboard-summary-strip'
import { DashboardTokenList } from '@/components/dashboard-token-list'
import { ProjectWorkspace } from '@/components/project-workspace'
import { SystemConfigWorkspace } from '@/components/system-config-workspace'
import { WorkspaceHeroPanel } from '@/components/workspace-hero-panel'
import { WorkspaceMetricCard } from '@/components/workspace-metric-card'
import { WorkspaceTabNav } from '@/components/workspace-tab-nav'

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

interface ConsumptionPagination {
  total: number
  page: number
  pageSize: number
  totalPages: number
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
  const [consumptionPagination, setConsumptionPagination] = useState<ConsumptionPagination>({
    total: 0,
    page: 1,
    pageSize: 10,
    totalPages: 1,
  })
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
    null | ((
      overrides?: Partial<ConsumptionQueryFilters>,
      source?: ConsumptionRefreshSource,
      page?: number,
    ) => Promise<void>)
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
    page: number = consumptionCurrentPage,
  ) => {
    try {
      setConsumptionLoading(true)
      setConsumptionRefreshSource(source)
      setConsumptionRefreshError(null)
      const params = buildConsumptionQueryParams(buildCurrentConsumptionFilters(overrides), {
        page,
        pageSize: itemsPerPage,
      })
      const requestUrl = params.toString()
        ? `/api/admin/consumptions?${params.toString()}`
        : '/api/admin/consumptions'
      const response = await fetch(requestUrl)
      const data = await response.json()
      if (data.success) {
        setConsumptionLogs(data.logs)
        setConsumptionPagination(data.pagination)
        if (data.pagination?.page !== page) {
          setConsumptionCurrentPage(data.pagination.page)
        }
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
  }, [buildCurrentConsumptionFilters, consumptionCurrentPage, itemsPerPage, showMessage])

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
    const normalizedProjectName = newProjectName.trim()
    const normalizedProjectKey = normalizeProjectKeyInput(newProjectKey)

    if (!normalizedProjectName || !normalizedProjectKey) {
      showMessage('项目名称和项目标识不能为空', 'error')
      return
    }

    const projectKeyValidationError = getProjectKeyValidationError(normalizedProjectKey)
    if (projectKeyValidationError) {
      showMessage(projectKeyValidationError, 'error')
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
          name: normalizedProjectName,
          projectKey: normalizedProjectKey,
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
  const getProjectDescriptionDraft = (project: Project) =>
    projectDescriptionDrafts[project.id] ?? (project.description || '')
  const hasProjectDescriptionChanged = (project: Project) =>
    getProjectDescriptionDraft(project).trim() !== (project.description || '').trim()
  const projectWorkspaceCreateForm = {
    name: newProjectName,
    projectKey: newProjectKey,
    description: newProjectDescription,
    onSubmit: handleCreateProject,
    onNameChange: setNewProjectName,
    onProjectKeyChange: setNewProjectKey,
    onDescriptionChange: setNewProjectDescription,
  }
  const projectWorkspaceManageView = {
    totalProjects: projects.length,
    searchTerm: projectManagementSearchTerm,
    statusFilter: projectManagementStatusFilter,
    sortBy: projectManagementSortBy,
    page: projectManagementPage,
    startIndex: projectManagementStartIndex,
    endIndex: projectManagementEndIndex,
    getProjectNameDraft,
    getProjectDescriptionDraft,
    hasProjectNameChanged,
    hasProjectDescriptionChanged,
    onSearchTermChange: (value: string) => {
      setProjectManagementSearchTerm(value)
      setProjectManagementCurrentPage(1)
    },
    onStatusFilterChange: (value: ProjectManagementStatusFilter) => {
      setProjectManagementStatusFilter(value)
      setProjectManagementCurrentPage(1)
    },
    onSortByChange: (value: ProjectManagementSortOption) => {
      setProjectManagementSortBy(value)
      setProjectManagementCurrentPage(1)
    },
    onPageChange: setProjectManagementCurrentPage,
    onProjectNameChange: handleProjectNameChange,
    onProjectDescriptionChange: handleProjectDescriptionChange,
    onCopyProjectKey: (projectKey: string) => void copyToClipboard(projectKey, '项目标识已复制'),
    onSaveProjectName: (project: Project) => void handleSaveProjectName(project),
    onSaveProjectDescription: (project: Project) => void handleSaveProjectDescription(project),
    onToggleProjectStatus: (project: Project) => void handleToggleProjectStatus(project),
    onDeleteProject: (project: Project) => void handleDeleteProject(project),
  }

  const getStatusBadge = (code: ActivationCode) => {
    const status = getCodeStatusLabel(code)

    if (status === '已过期') {
      return <DashboardStatusBadge label="已过期" tone="danger" />
    }
    if (status === '已耗尽') {
      return <DashboardStatusBadge label="已耗尽" tone="warning" />
    }
    if (status === '已使用' || status === '使用中') {
      return <DashboardStatusBadge label={status} tone="success" />
    }

    return <DashboardStatusBadge label="未激活" tone="info" />
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

  const consumptionProjectCoverage = new Set(
    consumptionLogs.map((log) => log.activationCode.project.projectKey),
  ).size
  const consumptionCodeCoverage = new Set(
    consumptionLogs.map((log) => log.activationCode.id),
  ).size
  const consumptionFilterTokens = [
    consumptionSearchTerm.trim() ? `关键词：${consumptionSearchTerm.trim()}` : null,
    consumptionProjectFilter !== 'all'
      ? `项目：${projects.find((project) => project.projectKey === consumptionProjectFilter)?.name || consumptionProjectFilter}`
      : null,
    consumptionCreatedFrom ? `开始：${new Date(consumptionCreatedFrom).toLocaleString()}` : null,
    consumptionCreatedTo ? `结束：${new Date(consumptionCreatedTo).toLocaleString()}` : null,
  ].filter((token): token is string => Boolean(token))

  const consumptionTotalPages = consumptionPagination.totalPages
  const consumptionStartIndex =
    consumptionPagination.total === 0
      ? 0
      : (consumptionPagination.page - 1) * consumptionPagination.pageSize + 1
  const consumptionEndIndex =
    consumptionPagination.total === 0
      ? 0
      : Math.min(
          consumptionPagination.page * consumptionPagination.pageSize,
          consumptionPagination.total,
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
  const codeBlockClassName =
    'overflow-x-auto rounded-[22px] border border-slate-200/80 bg-slate-950 px-4 py-4 font-mono text-[12px] leading-6 text-slate-100 shadow-[0_18px_56px_-42px_rgba(15,23,42,0.55)]'
  const paginationButtonClassName =
    'inline-flex h-10 min-w-[2.5rem] items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'
  const paginationActiveButtonClassName =
    'border-sky-500 bg-sky-500 text-white shadow-lg shadow-sky-500/20 hover:border-sky-500 hover:bg-sky-500'
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
    }, 'quick', 1)
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
      1,
    )
  }

  const handleChangeConsumptionPage = (nextPage: number) => {
    if (nextPage < 1 || nextPage > consumptionTotalPages || nextPage === consumptionCurrentPage) {
      return
    }

    setConsumptionCurrentPage(nextPage)
    void fetchConsumptionLogs({}, 'manual', nextPage)
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

  const activationCodeFiltersView = {
    searchTerm,
    statusFilter,
    projectFilter,
    cardTypeFilter,
    availableCardTypes: getAvailableCardTypes(),
    projectOptions: projects,
    filterTokens: activationCodeFilterTokens,
    statusSummary: activationCodeStatusSummary,
    onSearchTermChange: (value: string) => {
      setSearchTerm(value)
      setCurrentPage(1)
    },
    onStatusFilterChange: (value: StatusFilter) => {
      setStatusFilter(value)
      setCurrentPage(1)
    },
    onProjectFilterChange: (value: string) => {
      setProjectFilter(value)
      setCurrentPage(1)
    },
    onCardTypeFilterChange: (value: string) => {
      setCardTypeFilter(value)
      setCurrentPage(1)
    },
    onReset: handleResetCodeFilters,
    onExport: () => exportCodes(filteredCodes),
  }

  const activationCodeResultsView = {
    filterTokens: activationCodeFilterTokens,
    filteredCount: filteredCodes.length,
    startIndex: activationCodeStartIndex,
    endIndex: activationCodeEndIndex,
    currentPage,
    totalPages,
    codes: paginatedCodes,
    onExport: () => exportCodes(filteredCodes),
    onCleanup: () => void handleCleanupExpired(),
    onPageChange: setCurrentPage,
    onCopyCode: (code: string) => void copyToClipboard(code),
    onDeleteCode: (id: number) => void handleDeleteCode(id),
    getProjectDisplay,
    getStatusBadge,
    getLicenseModeDisplay,
    getSpecDisplay,
    getExpiryDisplay,
    getRemainingDisplay,
  }

  const consumptionFiltersView = {
    searchTerm: consumptionSearchTerm,
    projectFilter: consumptionProjectFilter,
    createdFrom: consumptionCreatedFrom,
    createdTo: consumptionCreatedTo,
    projectOptions: projects,
    filterTokens: consumptionFilterTokens,
    refreshStatusText: consumptionRefreshStatusText,
    refreshStatusBadgeClassName: consumptionRefreshStatusBadgeClassName,
    autoRefreshDelayMs: CONSUMPTION_AUTO_REFRESH_DELAY_MS,
    totalCount: consumptionPagination.total,
    onSearchTermChange: (value: string) => {
      setConsumptionSearchTerm(value)
      setConsumptionCurrentPage(1)
    },
    onProjectFilterChange: (value: string) => {
      setConsumptionProjectFilter(value)
      setConsumptionCurrentPage(1)
    },
    onCreatedFromChange: (value: string) => {
      setConsumptionCreatedFrom(value)
      setConsumptionCurrentPage(1)
    },
    onCreatedToChange: (value: string) => {
      setConsumptionCreatedTo(value)
      setConsumptionCurrentPage(1)
    },
    onRefresh: () => {
      void fetchConsumptionLogs({}, 'manual')
    },
    onExport: handleExportConsumptionLogs,
    onReset: handleResetConsumptionFilters,
    onApplyToday: () => handleApplyConsumptionQuickRange('today'),
    onApplyLast7Days: () => handleApplyConsumptionQuickRange('last7Days'),
    onApplyLast30Days: () => handleApplyConsumptionQuickRange('last30Days'),
    onClearTimeRange: handleClearConsumptionTimeRange,
  }

  const consumptionLogsView = {
    filterTokens: consumptionFilterTokens,
    refreshStatusText: consumptionRefreshStatusText,
    refreshStatusBadgeClassName: consumptionRefreshStatusBadgeClassName,
    autoRefreshDelayMs: CONSUMPTION_AUTO_REFRESH_DELAY_MS,
    totalCount: consumptionPagination.total,
    startIndex: consumptionStartIndex,
    endIndex: consumptionEndIndex,
    currentPage: consumptionPagination.page,
    totalPages: consumptionTotalPages,
    logs: consumptionLogs,
    onRefresh: () => {
      void fetchConsumptionLogs({}, 'manual')
    },
    onExport: handleExportConsumptionLogs,
    onPageChange: handleChangeConsumptionPage,
    getLicenseModeDisplay,
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

              <DashboardDataTable
                headers={[
                  '项目',
                  '项目标识',
                  '状态',
                  '总激活码',
                  '已激活',
                  '有效',
                  '已过期',
                  '次数剩余',
                  '次数消耗',
                ]}
                containerClassName="overflow-x-auto rounded-[24px] border border-slate-200/80"
                bodyClassName="bg-white divide-y divide-gray-200"
              >
                {filteredProjectStats.map((project) => (
                  <tr key={project.id} className="transition hover:bg-slate-50/80">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{project.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-500">{project.projectKey}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {project.isEnabled ? (
                        <DashboardStatusBadge label="启用中" tone="success" />
                      ) : (
                        <DashboardStatusBadge label="已停用" tone="neutral" />
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
              </DashboardDataTable>

              {filteredProjectStats.length === 0 && (
                <div className="py-8 text-center text-gray-500">
                  {projectStats.length === 0 ? '暂无项目统计数据' : '暂无匹配的项目统计数据'}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'projects' && (
          <ProjectWorkspace
            activeTab={projectWorkspaceTab}
            onTabChange={setProjectWorkspaceTab}
            enabledProjectsCount={enabledProjectsCount}
            disabledProjectsCount={disabledProjectsCount}
            loading={loading}
            createForm={projectWorkspaceCreateForm}
            manageView={projectWorkspaceManageView}
            panelClassName={panelClassName}
            workspaceSummaryCardClassName={workspaceSummaryCardClassName}
            compactInputClassName={compactInputClassName}
            primaryButtonClassName={primaryButtonClassName}
            paginationButtonClassName={paginationButtonClassName}
            paginationActiveButtonClassName={paginationActiveButtonClassName}
          />
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
                  <DashboardFormField label="所属项目" htmlFor="generate-selected-project-key">
                    <select
                      id="generate-selected-project-key"
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
                  </DashboardFormField>

                  <DashboardFormField label="授权类型" htmlFor="generate-license-mode">
                    <select
                      id="generate-license-mode"
                      value={licenseMode}
                      onChange={(e) => setLicenseMode(e.target.value as LicenseModeValue)}
                      className={compactInputClassName}
                    >
                      <option value="TIME">时间型</option>
                      <option value="COUNT">次数型</option>
                    </select>
                  </DashboardFormField>

                  <DashboardFormField label="生成数量" htmlFor="generate-amount">
                    <input
                      id="generate-amount"
                      type="number"
                      min="1"
                      max="100"
                      value={amount}
                      onChange={(e) => setAmount(parseInt(e.target.value))}
                      className={compactInputClassName}
                      required
                    />
                  </DashboardFormField>
                </div>

                {licenseMode === 'TIME' ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <DashboardFormField label="套餐类型" htmlFor="generate-card-type">
                      <select
                        id="generate-card-type"
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
                    </DashboardFormField>
                    <DashboardFormField label="有效期（天）" htmlFor="generate-expiry-days">
                      <input
                        id="generate-expiry-days"
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
                    </DashboardFormField>
                    <DashboardSubmitField
                      idleText="生成时间型激活码"
                      loadingText="生成中..."
                      loading={loading}
                      buttonClassName={primaryButtonClassName}
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DashboardFormField label="总次数" htmlFor="generate-total-count">
                      <input
                        id="generate-total-count"
                        type="number"
                        min="1"
                        value={totalCount}
                        onChange={(e) => setTotalCount(parseInt(e.target.value))}
                        className={compactInputClassName}
                        required
                      />
                    </DashboardFormField>
                    <DashboardSubmitField
                      idleText="生成次数型激活码"
                      loadingText="生成中..."
                      loading={loading}
                      buttonClassName={primaryButtonClassName}
                    />
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

                <DashboardDataTable headers={['项目', '激活码', '授权类型', '规格', '创建时间', '剩余次数', '操作']}>
                  {generatedCodes.map((code) => (
                    <tr key={code.id} className="transition hover:bg-slate-50/80">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getProjectDisplay(code)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">{code.code}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getLicenseModeDisplay(code.licenseMode)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getSpecDisplay(code)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(code.createdAt).toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getRemainingDisplay(code)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <DashboardInlineActionButton onClick={() => void copyToClipboard(code.code)}>
                          复制
                        </DashboardInlineActionButton>
                      </td>
                    </tr>
                  ))}
                </DashboardDataTable>
              </div>
            )}
          </div>
        )}

        {activeTab === 'list' && (
          <ActivationCodeWorkspace
            activeTab={activationCodeWorkspaceTab}
            onTabChange={setActivationCodeWorkspaceTab}
            loading={loading}
            matchedCount={filteredCodes.length}
            projectCoverage={activationCodeProjectCoverage}
            riskCount={activationCodeStatusSummary.risk}
            filtersView={activationCodeFiltersView}
            resultsView={activationCodeResultsView}
            panelClassName={panelClassName}
            workspaceSummaryCardClassName={workspaceSummaryCardClassName}
            compactInputClassName={compactInputClassName}
            primaryButtonClassName={primaryButtonClassName}
            successButtonClassName={successButtonClassName}
            warningButtonClassName={warningButtonClassName}
            ghostButtonClassName={ghostButtonClassName}
            paginationButtonClassName={paginationButtonClassName}
            paginationActiveButtonClassName={paginationActiveButtonClassName}
          />
        )}

        {activeTab === 'consumptions' && (
          <ConsumptionWorkspace
            activeTab={consumptionWorkspaceTab}
            onTabChange={setConsumptionWorkspaceTab}
            matchedCount={consumptionPagination.total}
            projectCoverage={consumptionProjectCoverage}
            codeCoverage={consumptionCodeCoverage}
            loading={consumptionLoading}
            filtersView={consumptionFiltersView}
            logsView={consumptionLogsView}
            panelClassName={panelClassName}
            workspaceSummaryCardClassName={workspaceSummaryCardClassName}
            compactInputClassName={compactInputClassName}
            primaryButtonClassName={primaryButtonClassName}
            successButtonClassName={successButtonClassName}
            ghostButtonClassName={ghostButtonClassName}
            paginationButtonClassName={paginationButtonClassName}
            paginationActiveButtonClassName={paginationActiveButtonClassName}
          />
        )}

        {activeTab === 'apiDocs' && (
          <ApiDocsWorkspace mode="dashboard" onFeedback={showMessage} />
        )}

        {activeTab === 'changePassword' && (
          <ChangePasswordWorkspace
            pageModel={changePasswordPageModel}
            completedChecklistCount={completedPasswordChecklistCount}
            currentPassword={currentPassword}
            newPassword={newPassword}
            confirmPassword={confirmPassword}
            loading={loading}
            inputClassName={inputClassName}
            panelClassName={panelClassName}
            onSubmit={handleChangePassword}
            onCurrentPasswordChange={setCurrentPassword}
            onNewPasswordChange={setNewPassword}
            onConfirmPasswordChange={setConfirmPassword}
            togglePasswordFieldVisibility={togglePasswordFieldVisibility}
            isPasswordFieldVisible={isPasswordFieldVisible}
          />
        )}

        {activeTab === 'systemConfig' && (
          <SystemConfigWorkspace
            pageModel={systemConfigPageModel}
            systemConfigsCount={systemConfigs.length}
            sensitiveCount={systemConfigSensitiveCount}
            whitelistEntryCount={systemConfigWhitelistEntryCount}
            loading={loading}
            inputClassName={inputClassName}
            panelClassName={panelClassName}
            onSubmit={handleUpdateSystemConfig}
            updateConfigValue={updateConfigValue}
            toggleSensitiveConfigVisibility={toggleSensitiveConfigVisibility}
            isSensitiveConfigVisible={isSensitiveConfigVisible}
          />
        )}
      </div>
    </main>
  )
}
