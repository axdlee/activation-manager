'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

// 定义激活码接口
import {
  adminAuditOperationTypeOptions,
  buildAdminOperationDetailSummary,
  buildAdminOperationTimelineDescription,
  getAdminOperationTypeLabel,
} from '@/lib/admin-audit-log-ui'
import {
  buildConsumptionAutoRefreshKey,
  CONSUMPTION_AUTO_REFRESH_DELAY_MS,
} from '@/lib/consumption-auto-refresh'
import { buildConsumptionTrendComparisonSeries } from '@/lib/consumption-trend-comparison'
import { sanitizeCsvValue } from '@/lib/csv-utils'
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
  type LicenseModeValue,
} from '@/lib/license-status'
import { useConsumptionLogs } from '@/lib/use-consumption-logs'
import { useAdminAuditLogs } from '@/lib/use-admin-audit-logs'
import { useConsumptionTrend } from '@/lib/use-consumption-trend'
import { useDashboardData } from '@/lib/use-dashboard-data'
import { useDashboardStats } from '@/lib/use-dashboard-stats'
import { useChangePassword } from '@/lib/use-change-password'
import { useSystemConfigWorkspace } from '@/lib/use-system-config-workspace'
import { useProjectWorkspace } from '@/lib/use-project-workspace'
import { useActivationCodeGeneration } from '@/lib/use-activation-code-generation'
import { useActivationCodeManagement } from '@/lib/use-activation-code-management'
import {
  dashboardTabs,
  getDashboardTabMeta,
} from '@/lib/dashboard-tab-config'
import {
  type AuditLogWorkspaceTab,
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
  DEFAULT_ALLOW_AUTO_REBIND,
  DEFAULT_AUTO_REBIND_COOLDOWN_MINUTES,
  DEFAULT_AUTO_REBIND_MAX_COUNT,
  formatAutoRebindMaxCountLabel,
  formatCooldownMinutesLabel,
  resolveEffectiveRebindPolicy,
  toRebindOverrideSelectValue,
  type RebindOverrideSelectValue,
  type RebindPolicySource,
} from '@/lib/license-rebind-policy'
import {
  getInheritedRebindPlaceholder,
  getInheritedRebindPolicyOptionLabel,
  getRebindPolicySourceDisplayLabel,
  getScopedRebindCooldownLabel,
  getScopedRebindMaxCountLabel,
  getScopedRebindPolicyLabel,
} from '@/lib/rebind-policy-ui'
import { ApiDocsWorkspace } from '@/components/api-docs-workspace'
import { ActivationCodeWorkspace } from '@/components/activation-code-workspace'
import { AuditLogWorkspace } from '@/components/audit-log-workspace'
import { ChangePasswordWorkspace } from '@/components/change-password-workspace'
import { ConsumptionWorkspace } from '@/components/consumption-workspace'
import { DashboardDataTable } from '@/components/dashboard-data-table'
import { DashboardFormField } from '@/components/dashboard-form-field'
import { DashboardInlineActionButton } from '@/components/dashboard-inline-action-button'
import { DashboardStatsOverviewPanel } from '@/components/dashboard-stats-overview-panel'
import { DashboardStatusBadge } from '@/components/dashboard-status-badge'
import { DashboardSubmitField } from '@/components/dashboard-submit-field'
import { ProjectWorkspace } from '@/components/project-workspace'
import { ShopAdminPanel } from '@/components/shop-admin-panel'
import { LicenseApiMetricsPanel } from '@/components/license-api-metrics-panel'
import { SystemConfigWorkspace } from '@/components/system-config-workspace'
import { ThemeSwitcher } from '@/components/theme-switcher'
import { useToast } from '@/components/toast-provider'
import { AppInput } from '@/components/ui/app-input'
import { AppSelect } from '@/components/ui/app-select'
import type {
  ActivationCode,
  AuditLogQueryFilters,
  Project,
  StatusFilter,
  TabType,
} from '@/lib/dashboard-page-types'
import { handleCardTypeChange } from '@/lib/dashboard-form-utils'
import { buildExportUrl, triggerFileDownload } from '@/lib/download-utils'
import {
  compactInputClassName,
  dangerButtonClassName,
  ghostButtonClassName,
  inputClassName,
  mutedPanelClassName,
  paginationActiveButtonClassName,
  paginationButtonClassName,
  panelClassName,
  primaryButtonClassName,
  successButtonClassName,
  warningButtonClassName,
  workspaceSummaryCardClassName,
} from '@/lib/dashboard-class-names'
import { cardTypes, statusFilterLabelMap } from '@/lib/dashboard-page-types'

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<TabType>('stats')
  const [licenseMode, setLicenseMode] = useState<LicenseModeValue>('TIME')
  const [selectedProjectKey, setSelectedProjectKey] = useState('default')
  const consumption = useConsumptionLogs()
  const {
    logs: consumptionLogs,
    loading: consumptionLoading,
    refreshSource: consumptionRefreshSource,
    lastRefreshedAt: consumptionLastRefreshedAt,
    refreshError: consumptionRefreshError,
    pagination: consumptionPagination,
    currentPage: consumptionCurrentPage,
    setCurrentPage: setConsumptionCurrentPage,
    searchTerm: consumptionSearchTerm,
    setSearchTerm: setConsumptionSearchTerm,
    projectFilter: consumptionProjectFilter,
    setProjectFilter: setConsumptionProjectFilter,
    createdFrom: consumptionCreatedFrom,
    setCreatedFrom: setConsumptionCreatedFrom,
    createdTo: consumptionCreatedTo,
    setCreatedTo: setConsumptionCreatedTo,
    fetchConsumptionLogs: hookFetchConsumptionLogs,
    buildFilters: consumptionBuildFilters,
  } = consumption
  const trend = useConsumptionTrend()
  const {
    trend: consumptionTrend,
    comparisonTrend: comparisonConsumptionTrend,
    days: consumptionTrendDays,
    setDays: setConsumptionTrendDays,
    granularity: consumptionTrendGranularity,
    setGranularity: setConsumptionTrendGranularity,
    compareProjectKey: consumptionTrendCompareProjectKey,
    setCompareProjectKey: setConsumptionTrendCompareProjectKey,
    hideZeroBuckets: consumptionTrendHideZeroBuckets,
    setHideZeroBuckets: setConsumptionTrendHideZeroBuckets,
    loading: consumptionTrendLoading,
    error: consumptionTrendError,
    compareError: consumptionTrendCompareError,
    fetchTrend: fetchConsumptionTrend,
  } = trend
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [statsProjectFilter, setStatsProjectFilter] = useState<'all' | string>('all')
  const [cardTypeFilter, setCardTypeFilter] = useState<'all' | string>('all')
  const [projectFilter, setProjectFilter] = useState<'all' | string>('all')
  const audit = useAdminAuditLogs()
  const {
    logs: auditLogs,
    loading: auditLogLoading,
    pagination: auditLogPagination,
    currentPage: auditLogCurrentPage,
    setCurrentPage: setAuditLogCurrentPage,
    searchTerm: auditLogSearchTerm,
    setSearchTerm: setAuditLogSearchTerm,
    projectFilter: auditLogProjectFilter,
    setProjectFilter: setAuditLogProjectFilter,
    operationTypeFilter: auditLogOperationTypeFilter,
    setOperationTypeFilter: setAuditLogOperationTypeFilter,
    createdFrom: auditLogCreatedFrom,
    setCreatedFrom: setAuditLogCreatedFrom,
    createdTo: auditLogCreatedTo,
    setCreatedTo: setAuditLogCreatedTo,
    buildFilters: auditBuildFilters,
    fetchAdminAuditLogs: hookFetchAdminAuditLogs,
  } = audit
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const [projectManagementSearchTerm, setProjectManagementSearchTerm] = useState('')
  const [projectManagementStatusFilter, setProjectManagementStatusFilter] =
    useState<ProjectManagementStatusFilter>('all')
  const [projectManagementSortBy, setProjectManagementSortBy] =
    useState<ProjectManagementSortOption>('createdAtDesc')
  const [activationCodeWorkspaceTab, setActivationCodeWorkspaceTab] =
    useState<ActivationCodeWorkspaceTab>('results')
  const [consumptionWorkspaceTab, setConsumptionWorkspaceTab] =
    useState<ConsumptionWorkspaceTab>('logs')
  const [auditLogWorkspaceTab, setAuditLogWorkspaceTab] =
    useState<AuditLogWorkspaceTab>('logs')
  const [projectWorkspaceTab, setProjectWorkspaceTab] = useState<ProjectWorkspaceTab>('manage')
  const router = useRouter()
  const hasConsumptionAutoRefreshInitializedRef = useRef(false)
  const skipNextConsumptionAutoRefreshRef = useRef(false)
  const hasAuditLogAutoRefreshInitializedRef = useRef(false)
  const skipNextAuditLogAutoRefreshRef = useRef(false)
  const hasFetchedInitialProjectsRef = useRef(false)
  const lastLoadedDashboardTabRef = useRef<TabType | null>(null)
  const fetchConsumptionLogsRef = useRef<
    null | ((
      overrides?: Partial<ConsumptionQueryFilters>,
      source?: ConsumptionRefreshSource,
      page?: number,
    ) => Promise<{ success: boolean; message?: string }>)
  >(null)
  const fetchAdminAuditLogsRef = useRef<
    null | ((
      overrides?: Partial<AuditLogQueryFilters>,
      page?: number,
    ) => Promise<{ success: boolean; message?: string }>)
  >(null)
  const hasCodeListInitializedRef = useRef(false)
  const skipNextCodeListRefreshRef = useRef(false)

  const showMessage = useCallback(
    (content: string, type: 'success' | 'error' = 'success') => {
      if (type === 'error') {
        toast.error(content)
      } else {
        toast.success(content)
      }
    },
    [toast],
  )

  const dashboardData = useDashboardData({ onShowMessage: showMessage })
  const {
    projects,
    systemConfigs,
    setSystemConfigs,
    loading,
    setLoading,
    fetchProjects: hookFetchProjects,
    codeList,
    fetchCodeList,
    fetchSystemConfigs: hookFetchSystemConfigs,
  } = dashboardData
  const dashboardStats = useDashboardStats()
  const {
    stats,
    projectStats,
    fetchStats,
  } = dashboardStats
  const changePassword = useChangePassword()
  const {
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    pageModel: changePasswordPageModel,
    completedChecklistCount: completedPasswordChecklistCount,
  } = changePassword
  const sysConfig = useSystemConfigWorkspace({
    systemConfigs,
    setSystemConfigs,
    onShowMessage: showMessage,
    onLoadingChange: setLoading,
    onFetchSystemConfigs: hookFetchSystemConfigs,
  })
  const {
    updateConfigValue,
    handleUpdateSystemConfig,
    togglePasswordFieldVisibility,
    isPasswordFieldVisible,
    toggleSensitiveConfigVisibility,
    isSensitiveConfigVisible,
    setRevealedSensitiveConfigKeys,
    setRevealedPasswordFieldKeys,
    systemConfigPageModel,
    systemConfigSensitiveCount,
    systemConfigWhitelistEntryCount,
  } = sysConfig
  const fetchProjectsRef = useRef<() => Promise<void>>(async () => {})
  const fetchActivationCodeDetail = useCallback(async (id: number) => {
    try {
      const response = await fetch(`/api/admin/codes/${id}`)
      const data = await response.json()
      if (data.success) {
        return data.activationCode as ActivationCode
      }
    } catch (error) {
      console.error('获取激活码详情失败:', error)
    }
    return null
  }, [])

  // 统一的服务端激活码列表刷新：带当前筛选与页码，替代全量加载
  const fetchCurrentCodePage = useCallback(async () => {
    const list = await fetchCodeList({
      keyword: searchTerm,
      status: statusFilter,
      projectKey: projectFilter,
      cardType: cardTypeFilter,
      page: currentPage,
      pageSize: itemsPerPage,
    })
    return list.codes
  }, [fetchCodeList, searchTerm, statusFilter, projectFilter, cardTypeFilter, currentPage, itemsPerPage])

  const codeMgmt = useActivationCodeManagement({
    allCodes: [],
    onShowMessage: showMessage,
    onLoadingChange: setLoading,
    onFetchAllCodes: fetchCurrentCodePage,
    onFetchActivationCodeDetail: fetchActivationCodeDetail,
    onFetchStats: fetchStats,
  })
  const {
    selectedActivationCodeId,
    selectedActivationCodeDetail,
    selectedActivationCodeRebindPolicy,
    setSelectedActivationCodeRebindPolicy,
    selectedActivationCodeRebindCooldownMinutes,
    setSelectedActivationCodeRebindCooldownMinutes,
    selectedActivationCodeRebindMaxCount,
    setSelectedActivationCodeRebindMaxCount,
    selectedActivationCodeTargetMachineId,
    setSelectedActivationCodeTargetMachineId,
    selectedActivationCodeAdminReason,
    setSelectedActivationCodeAdminReason,
    selectActivationCodeForManagement,
    handleSaveActivationCodeRebindSettings,
    handleForceUnbindActivationCode,
    handleForceRebindActivationCode,
    handleDeleteCode,
    handleCleanupExpired,
  } = codeMgmt
  const projectWorkspace = useProjectWorkspace({
    onShowMessage: showMessage,
    onLoadingChange: setLoading,
    onFetchProjects: () => fetchProjectsRef.current(),
    onFetchStats: fetchStats,
    onSetProjectWorkspaceTab: (tab: string) => setProjectWorkspaceTab(tab as ProjectWorkspaceTab),
  })
  const {
    newProjectName,
    setNewProjectName,
    newProjectKey,
    setNewProjectKey,
    newProjectDescription,
    setNewProjectDescription,
    newProjectRebindPolicy,
    setNewProjectRebindPolicy,
    newProjectRebindCooldownMinutes,
    setNewProjectRebindCooldownMinutes,
    newProjectRebindMaxCount,
    setNewProjectRebindMaxCount,
    projectManagementCurrentPage,
    setProjectManagementCurrentPage,
    projectNameDrafts,
    setProjectNameDrafts,
    projectDescriptionDrafts,
    setProjectDescriptionDrafts,
    projectRebindPolicyDrafts,
    setProjectRebindPolicyDrafts,
    projectRebindCooldownMinutesDrafts,
    setProjectRebindCooldownMinutesDrafts,
    projectRebindMaxCountDrafts,
    setProjectRebindMaxCountDrafts,
    handleCreateProject,
    handleToggleProjectStatus,
    handleProjectNameChange,
    handleSaveProjectName,
    handleProjectDescriptionChange,
    handleSaveProjectDescription,
    handleProjectRebindPolicyChange,
    handleProjectRebindCooldownMinutesChange,
    handleProjectRebindMaxCountChange,
    handleSaveProjectRebindSettings,
    handleDeleteProject,
  } = projectWorkspace

  const getSystemRebindDefaults = useCallback(() => {
    const allowAutoRebindConfig = systemConfigs.find((config) => config.key === 'allowAutoRebind')
    const cooldownConfig = systemConfigs.find(
      (config) => config.key === 'autoRebindCooldownMinutes',
    )
    const maxCountConfig = systemConfigs.find((config) => config.key === 'autoRebindMaxCount')

    return {
      allowAutoRebind:
        typeof allowAutoRebindConfig?.value === 'boolean'
          ? allowAutoRebindConfig.value
          : DEFAULT_ALLOW_AUTO_REBIND,
      autoRebindCooldownMinutes:
        typeof cooldownConfig?.value === 'number'
          ? cooldownConfig.value
          : DEFAULT_AUTO_REBIND_COOLDOWN_MINUTES,
      autoRebindMaxCount:
        typeof maxCountConfig?.value === 'number'
          ? maxCountConfig.value
          : DEFAULT_AUTO_REBIND_MAX_COUNT,
    }
  }, [systemConfigs])

  const getRebindPolicySourceLabel = useCallback((source: RebindPolicySource) => {
    return getRebindPolicySourceDisplayLabel(source)
  }, [])

  const fetchProjects = useCallback(async () => {
    const projectList = await hookFetchProjects()
    if (projectList.length === 0) return

    const nextProjectNameDrafts: Record<number, string> = {}
    const nextProjectDescriptionDrafts: Record<number, string> = {}
    const nextProjectRebindPolicyDrafts: Record<number, RebindOverrideSelectValue> = {}
    const nextProjectRebindCooldownMinutesDrafts: Record<number, string> = {}
    const nextProjectRebindMaxCountDrafts: Record<number, string> = {}

    projectList.forEach((project: Project) => {
      nextProjectNameDrafts[project.id] = project.name
      nextProjectDescriptionDrafts[project.id] = project.description || ''
      nextProjectRebindPolicyDrafts[project.id] = toRebindOverrideSelectValue(
        project.allowAutoRebind,
      )
      nextProjectRebindCooldownMinutesDrafts[project.id] =
        project.autoRebindCooldownMinutes === null
          ? ''
          : String(project.autoRebindCooldownMinutes)
      nextProjectRebindMaxCountDrafts[project.id] =
        project.autoRebindMaxCount === null ? '' : String(project.autoRebindMaxCount)
    })

    setProjectNameDrafts(nextProjectNameDrafts)
    setProjectDescriptionDrafts(nextProjectDescriptionDrafts)
    setProjectRebindPolicyDrafts(nextProjectRebindPolicyDrafts)
    setProjectRebindCooldownMinutesDrafts(nextProjectRebindCooldownMinutesDrafts)
    setProjectRebindMaxCountDrafts(nextProjectRebindMaxCountDrafts)
    const enabledProjects = projectList.filter((project: Project) => project.isEnabled)
    const hasSelectedEnabledProject = enabledProjects.some(
      (project: Project) => project.projectKey === selectedProjectKey,
    )

    if (!hasSelectedEnabledProject) {
      const fallbackProject = enabledProjects[0] || projectList[0]
      if (fallbackProject) {
        setSelectedProjectKey(fallbackProject.projectKey)
      }
    }

    const hasStatsProjectFilter = projectList.some(
      (project: Project) => project.projectKey === statsProjectFilter,
    )

    if (statsProjectFilter !== 'all' && !hasStatsProjectFilter) {
      setStatsProjectFilter('all')
    }

    const hasTrendCompareProject = projectList.some(
      (project: Project) => project.projectKey === consumptionTrendCompareProjectKey,
    )

    if (
      consumptionTrendCompareProjectKey !== 'none' &&
      (!hasTrendCompareProject ||
        (statsProjectFilter !== 'all' && consumptionTrendCompareProjectKey === statsProjectFilter))
    ) {
      setConsumptionTrendCompareProjectKey('none')
    }
  }, [hookFetchProjects, selectedProjectKey, statsProjectFilter, consumptionTrendCompareProjectKey, setConsumptionTrendCompareProjectKey, setProjectNameDrafts, setProjectDescriptionDrafts, setProjectRebindPolicyDrafts, setProjectRebindCooldownMinutesDrafts, setProjectRebindMaxCountDrafts])

  useEffect(() => {
    fetchProjectsRef.current = fetchProjects
  }, [fetchProjects])

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
    const ok = await hookFetchSystemConfigs()
    if (ok) setRevealedSensitiveConfigKeys([])
  }, [hookFetchSystemConfigs, setRevealedSensitiveConfigKeys])

  const codeGeneration = useActivationCodeGeneration({
    selectedProjectKey,
    licenseMode,
    cardTypes,
    refreshCodesOnGenerate: activeTab === 'list',
    isLoading: loading,
    onShowMessage: showMessage,
    onLoadingChange: setLoading,
    onFetchStats: fetchStats,
    onFetchAllCodes: fetchCurrentCodePage,
  })
  const {
    amount,
    setAmount,
    expiryDays,
    setExpiryDays,
    selectedCardType,
    setSelectedCardType,
    customDays,
    setCustomDays,
    totalCount,
    setTotalCount,
    generateRebindPolicy,
    setGenerateRebindPolicy,
    generateRebindCooldownMinutes,
    setGenerateRebindCooldownMinutes,
    generateRebindMaxCount,
    setGenerateRebindMaxCount,
    generatedCodes,
    handleGenerateCodes,
  } = codeGeneration

  const currentConsumptionFilters = useMemo<ConsumptionQueryFilters>(
    () => consumptionBuildFilters(),
    // consumptionBuildFilters 由 hook 内部状态派生，这里用过滤状态作为依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [consumptionCreatedFrom, consumptionCreatedTo, consumptionProjectFilter, consumptionSearchTerm],
  )
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

  const currentAuditLogFilters = useMemo<AuditLogQueryFilters>(
    () => auditBuildFilters(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [auditLogCreatedFrom, auditLogCreatedTo, auditLogOperationTypeFilter, auditLogProjectFilter, auditLogSearchTerm],
  )
  const auditLogAutoRefreshKey = useMemo(
    () => JSON.stringify(currentAuditLogFilters),
    [currentAuditLogFilters],
  )

  const buildCurrentAuditLogFilters = useCallback((
    overrides: Partial<AuditLogQueryFilters> = {},
  ): AuditLogQueryFilters => ({
    ...currentAuditLogFilters,
    ...overrides,
  }), [currentAuditLogFilters])

  // 消费日志 fetch 委托给 useConsumptionLogs hook，保留页面级 toast 提示
  const fetchConsumptionLogs = useCallback(async (
    overrides: Partial<ConsumptionQueryFilters> = {},
    source: ConsumptionRefreshSource = 'manual',
    page: number = consumptionCurrentPage,
  ) => {
    const result = await hookFetchConsumptionLogs(
      buildCurrentConsumptionFilters(overrides),
      page,
      source,
    )

    if (!result.success && source !== 'auto') {
      showMessage(result.message || '获取消费日志失败', 'error')
    }

    return result
  }, [buildCurrentConsumptionFilters, consumptionCurrentPage, hookFetchConsumptionLogs, showMessage])

  // 审计日志 fetch 委托给 useAdminAuditLogs hook
  const fetchAdminAuditLogs = useCallback(async (
    overrides: Partial<AuditLogQueryFilters> = {},
    page: number = auditLogCurrentPage,
  ) => {
    const result = await hookFetchAdminAuditLogs(
      buildCurrentAuditLogFilters(overrides),
      page,
    )

    if (!result.success) {
      showMessage(result.message || '获取审计日志失败', 'error')
    }

    return result
  }, [auditLogCurrentPage, buildCurrentAuditLogFilters, hookFetchAdminAuditLogs, showMessage])

  useEffect(() => {
    fetchConsumptionLogsRef.current = fetchConsumptionLogs
  }, [fetchConsumptionLogs])

  useEffect(() => {
    fetchAdminAuditLogsRef.current = fetchAdminAuditLogs
  }, [fetchAdminAuditLogs])

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

    if (
      activeTab === 'generate' ||
      activeTab === 'list' ||
      activeTab === 'projects' ||
      activeTab === 'consumptions' ||
      activeTab === 'auditLogs'
    ) {
      void fetchProjects()
    }
    if (activeTab === 'list') {
      void fetchCurrentCodePage()
    }
    if (activeTab === 'consumptions') {
      void fetchConsumptionLogs({}, 'initial')
    }
    if (activeTab === 'auditLogs') {
      setAuditLogCurrentPage(1)
      void fetchAdminAuditLogs({}, 1)
    }
    if (activeTab === 'systemConfig') {
      void fetchSystemConfigs()
    }
    if ((activeTab === 'generate' || activeTab === 'list' || activeTab === 'projects') && systemConfigs.length === 0) {
      void fetchSystemConfigs()
    }
    if (activeTab === 'stats') {
      void fetchStats()
    }
  }, [
    activeTab,
    fetchAdminAuditLogs,
    fetchConsumptionLogs,
    fetchCurrentCodePage,
    fetchProjects,
    fetchStats,
    fetchSystemConfigs,
    setAuditLogCurrentPage,
    systemConfigs.length,
  ])

  useEffect(() => {
    if (activeTab !== 'stats') {
      return
    }

    void fetchConsumptionTrend(statsProjectFilter)
  }, [activeTab, fetchConsumptionTrend, statsProjectFilter])

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

  useEffect(() => {
    if (activeTab !== 'auditLogs') {
      hasAuditLogAutoRefreshInitializedRef.current = false
      skipNextAuditLogAutoRefreshRef.current = false
      return
    }

    if (!hasAuditLogAutoRefreshInitializedRef.current) {
      hasAuditLogAutoRefreshInitializedRef.current = true
      return
    }

    if (skipNextAuditLogAutoRefreshRef.current) {
      skipNextAuditLogAutoRefreshRef.current = false
      return
    }

    const timer = window.setTimeout(() => {
      void fetchAdminAuditLogsRef.current?.({}, 1)
    }, CONSUMPTION_AUTO_REFRESH_DELAY_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [activeTab, auditLogAutoRefreshKey])

  // 激活码列表服务端分页自动刷新：筛选/翻页变化时防抖请求
  const codeListAutoRefreshKey = useMemo(
    () => JSON.stringify({ searchTerm, statusFilter, projectFilter, cardTypeFilter, currentPage }),
    [searchTerm, statusFilter, projectFilter, cardTypeFilter, currentPage],
  )

  useEffect(() => {
    if (activeTab !== 'list') {
      hasCodeListInitializedRef.current = false
      skipNextCodeListRefreshRef.current = false
      return
    }

    if (!hasCodeListInitializedRef.current) {
      hasCodeListInitializedRef.current = true
      return
    }

    if (skipNextCodeListRefreshRef.current) {
      skipNextCodeListRefreshRef.current = false
      return
    }

    const timer = window.setTimeout(() => {
      void fetchCurrentCodePage()
    }, CONSUMPTION_AUTO_REFRESH_DELAY_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [activeTab, codeListAutoRefreshKey, fetchCurrentCodePage])

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' })
      router.push('/admin/login')
    } catch (error) {
      console.error('登出失败:', error)
    }
  }



  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()

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
      '项目,激活码,授权类型,规格,状态,创建时间,过期时间,剩余次数,已用次数,使用时间,绑定设备 / machineId\n' +
      codes
        .map((code) => {
          const status = getCodeStatusLabel(code)
          return [
            sanitizeCsvValue(getProjectDisplay(code)),
            sanitizeCsvValue(code.code),
            sanitizeCsvValue(getLicenseModeDisplay(code.licenseMode)),
            sanitizeCsvValue(getSpecDisplay(code)),
            sanitizeCsvValue(status),
            sanitizeCsvValue(new Date(code.createdAt).toLocaleString()),
            sanitizeCsvValue(getExpiryDisplay(code)),
            sanitizeCsvValue(code.licenseMode === 'COUNT' ? String(code.remainingCount ?? 0) : ''),
            sanitizeCsvValue(code.licenseMode === 'COUNT' ? String(code.consumedCount ?? 0) : ''),
            sanitizeCsvValue(code.usedAt ? new Date(code.usedAt).toLocaleString() : ''),
            sanitizeCsvValue(code.usedBy || ''),
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

  const activationCodeStatusSummary = codeList.statusSummary
  const activationCodeProjectCoverage = codeList.projectCoverage
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

  const totalPages = Math.max(1, codeList.totalPages)
  const activationCodeStartIndex =
    codeList.total === 0 ? 0 : (codeList.page - 1) * (codeList.codes.length || 10) + 1
  const activationCodeEndIndex =
    codeList.total === 0 ? 0 : Math.min(codeList.page * (codeList.codes.length || 10), codeList.total)
  const paginatedCodes = codeList.codes
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
  const activeTabMeta = getDashboardTabMeta(activeTab)
  const heroMetricCards = [
    {
      label: '项目总数',
      value: projects.length,
      description: '当前后台已接入的项目数量',
    },
    {
      label: '激活码总量',
      value: stats.total || 0,
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
  const getProjectRebindPolicyDraft = (project: Project) =>
    projectRebindPolicyDrafts[project.id] ?? toRebindOverrideSelectValue(project.allowAutoRebind)
  const getProjectRebindCooldownMinutesDraft = (project: Project) =>
    projectRebindCooldownMinutesDrafts[project.id] ??
    (project.autoRebindCooldownMinutes === null ? '' : String(project.autoRebindCooldownMinutes))
  const getProjectRebindMaxCountDraft = (project: Project) =>
    projectRebindMaxCountDrafts[project.id] ??
    (project.autoRebindMaxCount === null ? '' : String(project.autoRebindMaxCount))
  const hasProjectRebindSettingsChanged = (project: Project) =>
    getProjectRebindPolicyDraft(project) !== toRebindOverrideSelectValue(project.allowAutoRebind) ||
    getProjectRebindCooldownMinutesDraft(project).trim() !==
      (project.autoRebindCooldownMinutes === null
        ? ''
        : String(project.autoRebindCooldownMinutes)) ||
    getProjectRebindMaxCountDraft(project).trim() !==
      (project.autoRebindMaxCount === null ? '' : String(project.autoRebindMaxCount))
  const projectWorkspaceCreateForm = {
    name: newProjectName,
    projectKey: newProjectKey,
    description: newProjectDescription,
    rebindPolicyValue: newProjectRebindPolicy,
    rebindCooldownMinutesValue: newProjectRebindCooldownMinutes,
    rebindMaxCountValue: newProjectRebindMaxCount,
    onSubmit: handleCreateProject,
    onNameChange: setNewProjectName,
    onProjectKeyChange: setNewProjectKey,
    onDescriptionChange: setNewProjectDescription,
    onRebindPolicyChange: (value: string) =>
      setNewProjectRebindPolicy(value as RebindOverrideSelectValue),
    onRebindCooldownMinutesChange: setNewProjectRebindCooldownMinutes,
    onRebindMaxCountChange: setNewProjectRebindMaxCount,
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
    getProjectRebindPolicyDraft,
    getProjectRebindCooldownMinutesDraft,
    getProjectRebindMaxCountDraft,
    hasProjectNameChanged,
    hasProjectDescriptionChanged,
    hasProjectRebindSettingsChanged,
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
    onProjectRebindPolicyChange: (projectId: number, value: string) =>
      handleProjectRebindPolicyChange(projectId, value as RebindOverrideSelectValue),
    onProjectRebindCooldownMinutesChange: handleProjectRebindCooldownMinutesChange,
    onProjectRebindMaxCountChange: handleProjectRebindMaxCountChange,
    onCopyProjectKey: (projectKey: string) => void copyToClipboard(projectKey, '项目标识已复制'),
    onSaveProjectName: (project: Project) => void handleSaveProjectName(project),
    onSaveProjectDescription: (project: Project) => void handleSaveProjectDescription(project),
    onSaveProjectRebindSettings: (project: Project) => void handleSaveProjectRebindSettings(project),
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

  const getAvailableCardTypes = () => codeList.availableCardTypes

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
  const auditLogOperatorCoverage = new Set(auditLogs.map((log) => log.adminUsername)).size
  const auditLogProjectCoverage = new Set(
    auditLogs
      .map((log) => log.project?.projectKey)
      .filter((projectKey): projectKey is string => Boolean(projectKey)),
  ).size
  const auditLogFilterTokens = [
    auditLogSearchTerm.trim() ? `关键词：${auditLogSearchTerm.trim()}` : null,
    auditLogProjectFilter !== 'all'
      ? `项目：${projects.find((project) => project.projectKey === auditLogProjectFilter)?.name || auditLogProjectFilter}`
      : null,
    auditLogOperationTypeFilter !== 'all'
      ? `操作：${
          adminAuditOperationTypeOptions.find((item) => item.value === auditLogOperationTypeFilter)
            ?.label || auditLogOperationTypeFilter
        }`
      : null,
    auditLogCreatedFrom ? `开始：${new Date(auditLogCreatedFrom).toLocaleString()}` : null,
    auditLogCreatedTo ? `结束：${new Date(auditLogCreatedTo).toLocaleString()}` : null,
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
  const auditLogTotalPages = auditLogPagination.totalPages
  const auditLogStartIndex =
    auditLogPagination.total === 0
      ? 0
      : (auditLogPagination.page - 1) * auditLogPagination.pageSize + 1
  const auditLogEndIndex =
    auditLogPagination.total === 0
      ? 0
      : Math.min(auditLogPagination.page * auditLogPagination.pageSize, auditLogPagination.total)
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
          ? 'border-brand-500/20 bg-brand-500/10 text-brand-400'
          : 'border-surface-200 bg-surface-50 text-ink-500'
  const shellClassName =
    'rounded-lg border border-surface-200 bg-surface-100 shadow-card'
  const handleExportConsumptionLogs = () => {
    const params = buildConsumptionQueryParams(buildCurrentConsumptionFilters())
    triggerFileDownload(buildExportUrl('/api/admin/consumptions/export', params))
  }

  const handleExportAdminAuditLogs = () => {
    const filters = buildCurrentAuditLogFilters()
    const params = new URLSearchParams()

    if (filters.projectKey !== 'all') {
      params.set('projectKey', filters.projectKey)
    }
    if (filters.keyword.trim()) {
      params.set('keyword', filters.keyword.trim())
    }
    if (filters.operationType !== 'all') {
      params.set('operationType', filters.operationType)
    }
    if (filters.createdFrom) {
      params.set('createdFrom', filters.createdFrom)
    }
    if (filters.createdTo) {
      params.set('createdTo', filters.createdTo)
    }

    triggerFileDownload(buildExportUrl('/api/admin/audit-logs/export', params))
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

  const handleResetAuditLogFilters = () => {
    skipNextAuditLogAutoRefreshRef.current = true
    setAuditLogSearchTerm('')
    setAuditLogProjectFilter('all')
    setAuditLogOperationTypeFilter('all')
    setAuditLogCreatedFrom('')
    setAuditLogCreatedTo('')
    setAuditLogCurrentPage(1)
    void fetchAdminAuditLogs(
      {
        keyword: '',
        projectKey: 'all',
        operationType: 'all',
        createdFrom: '',
        createdTo: '',
      },
      1,
    )
  }

  const handleChangeAuditLogWorkspaceTab = (tab: AuditLogWorkspaceTab) => {
    setAuditLogWorkspaceTab(tab)

    if (tab === 'logs') {
      setAuditLogCurrentPage(1)
      void fetchAdminAuditLogs({}, 1)
    }
  }

  const handleChangeAuditLogPage = (nextPage: number) => {
    if (
      nextPage < 1 ||
      nextPage > auditLogPagination.totalPages ||
      nextPage === auditLogPagination.page
    ) {
      return
    }

    setAuditLogCurrentPage(nextPage)
    void fetchAdminAuditLogs({}, nextPage)
  }

  const handleResetCodeFilters = () => {
    setSearchTerm('')
    setStatusFilter('all')
    setProjectFilter('all')
    setCardTypeFilter('all')
    setCurrentPage(1)
  }

  const selectedActivationCode =
    selectedActivationCodeId === null ? null : selectedActivationCodeDetail

  const buildActivationCodePolicySummary = useCallback(
    (activationCode: ActivationCode | null) => {
      if (!activationCode) {
        return [] as string[]
      }

      const effectivePolicy = resolveEffectiveRebindPolicy(
        {
          allowAutoRebind: activationCode.allowAutoRebind ?? null,
          autoRebindCooldownMinutes: activationCode.autoRebindCooldownMinutes ?? null,
          autoRebindMaxCount: activationCode.autoRebindMaxCount ?? null,
          project: activationCode.project
            ? {
                allowAutoRebind: activationCode.project.allowAutoRebind ?? null,
                autoRebindCooldownMinutes:
                  activationCode.project.autoRebindCooldownMinutes ?? null,
                autoRebindMaxCount: activationCode.project.autoRebindMaxCount ?? null,
              }
            : null,
        },
        getSystemRebindDefaults(),
      )

      return [
        `最终自助换绑：${effectivePolicy.allowAutoRebind ? '允许' : '禁止'}（来源：${getRebindPolicySourceLabel(
          effectivePolicy.allowAutoRebindSource,
        )}）`,
        `最终换绑冷却时间：${formatCooldownMinutesLabel(
          effectivePolicy.autoRebindCooldownMinutes,
        )}（来源：${getRebindPolicySourceLabel(
          effectivePolicy.autoRebindCooldownMinutesSource,
        )}）`,
        `最终自助换绑次数上限：${formatAutoRebindMaxCountLabel(
          effectivePolicy.autoRebindMaxCount,
        )}（来源：${getRebindPolicySourceLabel(
          effectivePolicy.autoRebindMaxCountSource,
        )}）`,
      ]
    },
    [getRebindPolicySourceLabel, getSystemRebindDefaults],
  )





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

    triggerFileDownload(buildExportUrl('/api/admin/codes/stats/export', params))
  }

  const formatCodeManagementTimestamp = (value: string | null | undefined) =>
    value ? new Date(value).toLocaleString() : '-'

  const getBindingHistoryTitle = (eventType: string) => {
    switch (eventType) {
      case 'AUTO_REBIND':
        return '自动换绑'
      case 'FORCE_UNBIND':
        return '管理员强制解绑'
      case 'FORCE_REBIND':
        return '管理员强制换绑'
      case 'REUSABLE_BINDING_RELEASED':
        return '系统释放旧绑定'
      default:
        return '首次绑定'
    }
  }

  const buildMachineTransitionDescription = (
    fromMachineId: string | null | undefined,
    toMachineId: string | null | undefined,
    reason: string | null | undefined,
  ) => {
    const transition = fromMachineId || toMachineId
      ? `${fromMachineId || '未绑定'} → ${toMachineId || '未绑定'}`
      : '未记录设备变化'

    return reason ? `${transition} · ${reason}` : transition
  }

  const buildBindingHistoryEntries = (activationCode: ActivationCode | null) =>
    (activationCode?.bindingHistories || []).map((entry) => ({
      id: entry.id,
      title: getBindingHistoryTitle(entry.eventType),
      description: buildMachineTransitionDescription(
        entry.fromMachineId,
        entry.toMachineId,
        entry.reason,
      ),
      timestamp: formatCodeManagementTimestamp(entry.createdAt),
    }))

  const buildAdminAuditEntries = (activationCode: ActivationCode | null) =>
    (activationCode?.adminAuditLogs || []).map((entry) => ({
      id: entry.id,
      title: getAdminOperationTypeLabel(entry.operationType),
      description: buildAdminOperationTimelineDescription(entry),
      timestamp: formatCodeManagementTimestamp(entry.createdAt),
    }))

  const activationCodeFiltersView = {
    searchTerm,
    statusFilter,
    projectFilter,
    cardTypeFilter,
    availableCardTypes: codeList.availableCardTypes.length > 0 ? codeList.availableCardTypes : getAvailableCardTypes(),
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
    onExport: () => {
      const params = new URLSearchParams()
      if (searchTerm.trim()) params.set('keyword', searchTerm.trim())
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (projectFilter !== 'all') params.set('projectKey', projectFilter)
      if (cardTypeFilter !== 'all') params.set('cardType', cardTypeFilter)
      void fetch(`/api/admin/codes/list?${params}`)
        .then((r) => r.json())
        .then((data) => { if (data.success) exportCodes(data.codes) })
        .catch(() => showMessage('导出失败', 'error'))
    },
  }

  const activationCodeResultsView = {
    filterTokens: activationCodeFilterTokens,
    filteredCount: codeList.total,
    startIndex: activationCodeStartIndex,
    endIndex: activationCodeEndIndex,
    currentPage,
    totalPages,
    codes: paginatedCodes,
    onExport: () => {
      const params = new URLSearchParams()
      if (searchTerm.trim()) params.set('keyword', searchTerm.trim())
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (projectFilter !== 'all') params.set('projectKey', projectFilter)
      if (cardTypeFilter !== 'all') params.set('cardType', cardTypeFilter)
      void fetch(`/api/admin/codes/list?${params}`)
        .then((r) => r.json())
        .then((data) => { if (data.success) exportCodes(data.codes) })
        .catch(() => showMessage('导出失败', 'error'))
    },
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
    managementView: {
      selectedCodeId: selectedActivationCode?.id ?? null,
      selectedCodeTitle: selectedActivationCode?.code ?? '',
      selectedCodeSubtitle: selectedActivationCode
        ? `${getProjectDisplay(selectedActivationCode)} · ${
            selectedActivationCode.project?.projectKey || selectedActivationCode.projectId
          }`
        : '',
      bindingDeviceDisplay: selectedActivationCode?.usedBy || '未绑定',
      usedAtDisplay: selectedActivationCode?.usedAt
        ? new Date(selectedActivationCode.usedAt).toLocaleString()
        : '-',
      lastBoundAtDisplay: selectedActivationCode?.lastBoundAt
        ? new Date(selectedActivationCode.lastBoundAt).toLocaleString()
        : '-',
      lastRebindAtDisplay: selectedActivationCode?.lastRebindAt
        ? new Date(selectedActivationCode.lastRebindAt).toLocaleString()
        : '-',
      rebindCountDisplay: `${selectedActivationCode?.rebindCount ?? 0} 次`,
      autoRebindCountDisplay: `${selectedActivationCode?.autoRebindCount ?? 0} 次`,
      effectivePolicySummary: buildActivationCodePolicySummary(selectedActivationCode),
      overridePolicyValue: selectedActivationCodeRebindPolicy,
      overrideCooldownMinutesValue: selectedActivationCodeRebindCooldownMinutes,
      overrideMaxCountValue: selectedActivationCodeRebindMaxCount,
      targetMachineId: selectedActivationCodeTargetMachineId,
      adminActionReason: selectedActivationCodeAdminReason,
      bindingHistoryEntries: buildBindingHistoryEntries(selectedActivationCodeDetail ?? selectedActivationCode),
      adminAuditEntries: buildAdminAuditEntries(selectedActivationCodeDetail ?? selectedActivationCode),
      loading,
      onSelectCode: selectActivationCodeForManagement,
      onOverridePolicyChange: (value: string) =>
        setSelectedActivationCodeRebindPolicy(value as RebindOverrideSelectValue),
      onOverrideCooldownMinutesChange: setSelectedActivationCodeRebindCooldownMinutes,
      onOverrideMaxCountChange: setSelectedActivationCodeRebindMaxCount,
      onTargetMachineIdChange: setSelectedActivationCodeTargetMachineId,
      onAdminActionReasonChange: setSelectedActivationCodeAdminReason,
      onSaveSettings: () => void handleSaveActivationCodeRebindSettings(),
      onForceUnbind: () => void handleForceUnbindActivationCode(),
      onForceRebind: () => void handleForceRebindActivationCode(),
    },
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

  const auditLogFiltersView = {
    searchTerm: auditLogSearchTerm,
    projectFilter: auditLogProjectFilter,
    operationTypeFilter: auditLogOperationTypeFilter,
    createdFrom: auditLogCreatedFrom,
    createdTo: auditLogCreatedTo,
    projectOptions: projects,
    operationTypeOptions: adminAuditOperationTypeOptions,
    filterTokens: auditLogFilterTokens,
    onSearchTermChange: (value: string) => {
      setAuditLogSearchTerm(value)
      setAuditLogCurrentPage(1)
    },
    onProjectFilterChange: (value: string) => {
      setAuditLogProjectFilter(value)
      setAuditLogCurrentPage(1)
    },
    onOperationTypeFilterChange: (value: string) => {
      setAuditLogOperationTypeFilter(value)
      setAuditLogCurrentPage(1)
    },
    onCreatedFromChange: (value: string) => {
      setAuditLogCreatedFrom(value)
      setAuditLogCurrentPage(1)
    },
    onCreatedToChange: (value: string) => {
      setAuditLogCreatedTo(value)
      setAuditLogCurrentPage(1)
    },
    onReset: handleResetAuditLogFilters,
    onExport: handleExportAdminAuditLogs,
  }

  const auditLogLogsView = {
    filterTokens: auditLogFilterTokens,
    totalCount: auditLogPagination.total,
    startIndex: auditLogStartIndex,
    endIndex: auditLogEndIndex,
    currentPage: auditLogPagination.page,
    totalPages: auditLogTotalPages,
    logs: auditLogs.map((log) => ({
      ...log,
      operationTypeLabel: getAdminOperationTypeLabel(log.operationType),
      detailSummary: buildAdminOperationDetailSummary(log.operationType, log.detailJson),
    })),
    onExport: handleExportAdminAuditLogs,
    onPageChange: handleChangeAuditLogPage,
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
  }, [consumptionCurrentPage, consumptionTotalPages, setConsumptionCurrentPage])

  useEffect(() => {
    const lastPage = Math.max(auditLogTotalPages, 1)

    if (auditLogCurrentPage > lastPage) {
      setAuditLogCurrentPage(lastPage)
    }
  }, [auditLogCurrentPage, auditLogTotalPages, setAuditLogCurrentPage])

  return (
    <main className="min-h-screen bg-surface-100 px-4 py-5 text-ink-50 sm:px-6 lg:h-screen lg:overflow-hidden lg:px-8">
      <div className="mx-auto h-full w-full max-w-none">
        <div className="flex h-full flex-col gap-5 lg:flex-row">
          <aside className="lg:flex lg:w-[300px] lg:shrink-0 lg:self-stretch">
            <section className={`${shellClassName} p-5 lg:flex lg:h-full lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden`}>
              <div className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:space-y-0">
                <div className="shrink-0 border-b border-surface-200 pb-5">
                  <div className="inline-flex items-center gap-2 rounded-sm border border-brand-500/20 bg-brand-500/10 px-2.5 py-1 text-xs font-medium text-brand-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-500/100" />
                    授权运营中台
                  </div>
                  <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink-50">
                    激活码管理后台
                  </h1>
                  <p className="mt-2 text-sm leading-6 text-ink-500">
                    项目、发码、激活码、消费、审计与 API 接入统一工作台。
                  </p>
                </div>

                <div className="dashboard-scroll-area mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
                  <nav className="space-y-1">
                    {dashboardTabs.map((tab) => {
                      const isActive = activeTab === tab.key

                      return (
                        <button
                          key={tab.key}
                          onClick={() => setActiveTab(tab.key)}
                          className={`group flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-all ${
                            isActive
                              ? 'border-brand-500/20 bg-brand-500/10 text-brand-300'
                              : 'border-transparent text-ink-300 hover:border-surface-200 hover:bg-surface-50 hover:text-ink-50'
                          }`}
                        >
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${
                              isActive ? 'bg-brand-600 text-white' : 'bg-surface-200 text-ink-500'
                            }`}
                          >
                            {tab.shortLabel}
                          </span>
                          <span className="min-w-0">
                            <span className={`block text-sm font-medium ${isActive ? 'text-brand-300' : 'text-ink-100'}`}>
                              {tab.label}
                            </span>
                            <span className={`mt-0.5 block truncate text-xs leading-5 ${isActive ? 'text-brand-400' : 'text-ink-500'}`}>
                              {tab.description}
                            </span>
                          </span>
                        </button>
                      )
                    })}
                  </nav>

                  <div className="mt-5 grid grid-cols-1 gap-2.5">
                    {heroMetricCards.map((item) => (
                      <div key={item.label} className="rounded-md border border-surface-200 bg-surface-50 px-4 py-3.5">
                        <div className="text-xs font-medium text-ink-500">{item.label}</div>
                        <div className="tabular-nums mt-1.5 text-2xl font-semibold tracking-tight text-ink-50">{item.value}</div>
                        <div className="mt-1 text-xs leading-5 text-ink-500">{item.description}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="shrink-0 space-y-2 pt-4">
                  <ThemeSwitcher />
                  <button onClick={handleLogout} className={`w-full ${dangerButtonClassName}`}>
                    登出
                  </button>
                </div>
              </div>
            </section>
          </aside>

          <div className="min-w-0 flex-1 lg:min-h-0 lg:overflow-hidden">
            <div className="space-y-5 lg:h-full lg:overflow-y-auto lg:pr-2 dashboard-scroll-area">
              <section className={`${shellClassName} p-6`}>
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                  <div className="max-w-3xl">
                    <div className="inline-flex items-center gap-2 rounded-sm border border-brand-500/20 bg-brand-500/10 px-2.5 py-1 text-xs font-medium text-brand-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-500/100" />
                      当前模块 · {activeTabMeta.label}
                    </div>
                    <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink-50">
                      {activeTabMeta.label}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-7 text-ink-500">
                      {activeTabMeta.description}
                    </p>
                  </div>
                  <div className="max-w-sm rounded-md border border-surface-200 bg-surface-50 px-4 py-3 text-sm leading-6 text-ink-500 xl:shrink-0">
                    在此查看项目、激活码与消费数据的实时概况，所有操作集中在左侧导航。
                  </div>
                </div>
              </section>

              {activeTab === 'stats' && (
                <div className="space-y-6">
            <DashboardStatsOverviewPanel
              statsScopeLabel={statsScopeLabel}
              statsCards={statsCards}
              displayStats={displayStats}
              countUsageRateText={countUsageRateText}
              countUsageRateDescription={countUsageRateDescription}
              peakConsumptionProjectText={peakConsumptionProjectText}
              peakConsumptionProjectDescription={peakConsumptionProjectDescription}
              panelClassName={panelClassName}
              mutedPanelClassName={mutedPanelClassName}
            />

            <LicenseApiMetricsPanel panelClassName={panelClassName} />

            <div className="relative overflow-hidden rounded-lg shadow-card">
              <div className="absolute inset-0 bg-ink-950" />
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
                    <div className="inline-flex rounded-full bg-surface-100 p-1">
                      {[7, 30].map((days) => (
                        <button
                          key={days}
                          type="button"
                          onClick={() => setConsumptionTrendDays(days as 7 | 30)}
                          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                            consumptionTrendDays === days
                              ? 'bg-surface-100 text-ink-50 shadow-sm'
                              : 'text-blue-100 hover:bg-surface-100'
                          }`}
                        >
                          近 {days} 天
                        </button>
                      ))}
                    </div>

                    <AppSelect
                      value={consumptionTrendGranularity}
                      onChange={(e) =>
                        setConsumptionTrendGranularity(e.target.value as 'day' | 'week' | 'month')
                      }
                      className="rounded-full border border-surface-200 bg-surface-100 px-4 py-2 text-sm text-white outline-none"
                    >
                      <option value="day" className="text-ink-50">按日</option>
                      <option value="week" className="text-ink-50">按周</option>
                      <option value="month" className="text-ink-50">按月</option>
                    </AppSelect>

                    <AppSelect
                      value={consumptionTrendCompareProjectKey}
                      onChange={(e) =>
                        setConsumptionTrendCompareProjectKey(e.target.value as 'none' | string)
                      }
                      className="rounded-full border border-surface-200 bg-surface-100 px-4 py-2 text-sm text-white outline-none"
                    >
                      <option value="none" className="text-ink-50">不对比项目</option>
                      {availableConsumptionTrendCompareProjects.map((project) => (
                        <option key={project.id} value={project.projectKey} className="text-ink-50">
                          对比：{project.name}
                        </option>
                      ))}
                    </AppSelect>

                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-surface-200 bg-surface-100 px-4 py-2 text-sm text-ink-50">
                      <input
                        type="checkbox"
                        checked={consumptionTrendHideZeroBuckets}
                        onChange={(e) => setConsumptionTrendHideZeroBuckets(e.target.checked)}
                        className="h-4 w-4 rounded border-white/20 bg-transparent text-brand-300 focus:ring-cyan-300"
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

                <div
                  className={`mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 ${
                    hasComparisonConsumptionTrend
                      ? 'xl:grid-cols-3 2xl:grid-cols-6'
                      : 'xl:grid-cols-4'
                  }`}
                >
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
                    <div key={String(label)} className="rounded-md border border-surface-200 bg-surface-100 px-4 py-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-blue-100/60">{label}</div>
                      <div className="mt-3 text-3xl font-semibold text-white">{value}</div>
                      <div className="mt-2 text-xs text-blue-100/70">{description}</div>
                    </div>
                  ))}
                </div>

                <div className="rounded-md border border-surface-200 bg-surface-100 p-4">
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
                        <div className="rounded-md border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-50">
                          {consumptionTrendCompareError}
                        </div>
                      )}

                      {consumptionTrendHideZeroBuckets && hiddenZeroBucketCount > 0 && (
                        <div className="rounded-md border border-brand-500/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-50">
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
                                  <div className="text-[11px] text-ink-300">
                                    {point.primaryCount} / {point.secondaryCount}
                                  </div>
                                  <div className="flex w-full flex-1 items-end justify-center gap-1">
                                    <div
                                      title={`${statsScopeLabel} · ${point.date}：${point.primaryCount} 次`}
                                      className={`w-full max-w-[16px] rounded-t-2xl border border-surface-200 bg-gradient-to-t from-brand-400 via-brand-500 to-brand-600 shadow-card transition-all duration-200 group-hover:brightness-110 ${
                                        point.primaryCount > 0 ? 'opacity-100' : 'opacity-40'
                                      }`}
                                      style={{ height: `${primaryBarHeight}%` }}
                                    />
                                    <div
                                      title={`${selectedComparisonProject?.name || '对比项目'} · ${point.date}：${point.secondaryCount} 次`}
                                      className={`w-full max-w-[16px] rounded-t-2xl border border-surface-200 bg-gradient-to-t from-brand-500 via-brand-600 to-brand-700 shadow-card transition-all duration-200 group-hover:brightness-110 ${
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
                                  <div className="text-[11px] text-ink-300">{point.count}</div>
                                  <div className="flex w-full flex-1 items-end justify-center">
                                    <div
                                      title={`${point.date}：${point.count} 次`}
                                      className={`w-full max-w-[36px] rounded-t-2xl border border-surface-200 bg-gradient-to-t from-brand-400 via-brand-500 to-brand-600 shadow-card transition-all duration-200 group-hover:brightness-110 ${
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
                        <div className="flex h-72 items-center justify-center text-sm text-ink-300">
                          暂无可展示的趋势时间桶
                        </div>
                      )}

                      {consumptionTrendHideZeroBuckets && !hasVisibleConsumptionTrendPoints ? (
                        <div className="rounded-md border border-dashed border-surface-200 bg-surface-100 px-4 py-3 text-sm text-ink-300">
                          当前已隐藏所有零值时间桶，本时间范围暂无实际消费记录。你可以关闭该选项观察完整时间轴。
                        </div>
                      ) : !hasConsumptionTrendData && (
                        <div className="rounded-md border border-dashed border-surface-200 bg-surface-100 px-4 py-3 text-sm text-ink-300">
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
                  <h3 className="text-lg font-semibold text-ink-50">项目级统计</h3>
                  <p className="mt-1 text-sm text-ink-500">按项目查看发码、激活、有效、剩余次数与累计消耗。</p>
                </div>
                <div className="flex w-full max-w-2xl flex-col gap-3 md:flex-row md:items-end">
                  <div className="flex-1">
                    <label className="mb-2 block text-sm font-medium text-ink-200">项目筛选</label>
                    <AppSelect
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
                    </AppSelect>
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
                tableClassName="w-full min-w-[1120px] divide-y divide-surface-200"
                bodyClassName="bg-surface-100 divide-y divide-surface-200"
              >
                {filteredProjectStats.map((project) => (
                  <tr key={project.id} className="transition hover:bg-surface-50">
                    <td className="px-6 py-4 text-sm font-medium text-ink-50">{project.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-ink-500">{project.projectKey}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-ink-400">
                      {project.isEnabled ? (
                        <DashboardStatusBadge label="启用中" tone="success" />
                      ) : (
                        <DashboardStatusBadge label="已停用" tone="neutral" />
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-ink-500">{project.totalCodes}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-ink-500">{project.usedCodes}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-ink-500">{project.activeCodes}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-ink-500">{project.expiredCodes}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-ink-200">{project.countRemainingTotal}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-ink-200">{project.countConsumedTotal}</td>
                  </tr>
                ))}
              </DashboardDataTable>

              {filteredProjectStats.length === 0 && (
                <div className="py-8 text-center text-ink-400">
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
            ghostButtonClassName={ghostButtonClassName}
            paginationButtonClassName={paginationButtonClassName}
            paginationActiveButtonClassName={paginationActiveButtonClassName}
          />
        )}

        {activeTab === 'generate' && (
          <div className="space-y-6">
            <div className={`${panelClassName} p-6`}>
              <div className="mb-5">
                <h2 className="text-xl font-semibold text-ink-50">生成激活码</h2>
                <p className="mt-1 text-sm leading-6 text-ink-500">
                  统一使用更圆润的表单样式，减少录入压迫感，同时保持时间卡与次数卡的生成流程清晰可读。
                </p>
              </div>

              <form onSubmit={handleGenerateCodes} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
                  <DashboardFormField label="所属项目" htmlFor="generate-selected-project-key">
                    <AppSelect
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
                    </AppSelect>
                  </DashboardFormField>

                  <DashboardFormField label="授权类型" htmlFor="generate-license-mode">
                    <AppSelect
                      id="generate-license-mode"
                      value={licenseMode}
                      onChange={(e) => setLicenseMode(e.target.value as LicenseModeValue)}
                      className={compactInputClassName}
                    >
                      <option value="TIME">时间型</option>
                      <option value="COUNT">次数型</option>
                    </AppSelect>
                  </DashboardFormField>

                  <DashboardFormField label="生成数量" htmlFor="generate-amount">
                    <AppInput
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

                  <DashboardFormField
                    label={getScopedRebindPolicyLabel('code')}
                    htmlFor="generate-rebind-policy"
                  >
                    <AppSelect
                      id="generate-rebind-policy"
                      value={generateRebindPolicy}
                      onChange={(e) =>
                        setGenerateRebindPolicy(e.target.value as RebindOverrideSelectValue)
                      }
                      className={compactInputClassName}
                    >
                      <option value="inherit">{getInheritedRebindPolicyOptionLabel('code')}</option>
                      <option value="enabled">允许自助换绑</option>
                      <option value="disabled">禁止自助换绑</option>
                    </AppSelect>
                  </DashboardFormField>

                  <DashboardFormField
                    label={getScopedRebindCooldownLabel('code')}
                    htmlFor="generate-rebind-cooldown"
                  >
                    <AppInput
                      id="generate-rebind-cooldown"
                      type="number"
                      min="0"
                      value={generateRebindCooldownMinutes}
                      onChange={(e) => setGenerateRebindCooldownMinutes(e.target.value)}
                      className={compactInputClassName}
                      placeholder={getInheritedRebindPlaceholder('code', 'cooldown')}
                    />
                  </DashboardFormField>

                  <DashboardFormField
                    label={getScopedRebindMaxCountLabel('code')}
                    htmlFor="generate-rebind-max-count"
                  >
                    <AppInput
                      id="generate-rebind-max-count"
                      type="number"
                      min="0"
                      value={generateRebindMaxCount}
                      onChange={(e) => setGenerateRebindMaxCount(e.target.value)}
                      className={compactInputClassName}
                      placeholder={getInheritedRebindPlaceholder('code', 'maxCount')}
                    />
                  </DashboardFormField>
                </div>

                {licenseMode === 'TIME' ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <DashboardFormField label="套餐类型" htmlFor="generate-card-type">
                      <AppSelect
                        id="generate-card-type"
                        value={selectedCardType}
                        onChange={(e) => handleCardTypeChange(e.target.value, setSelectedCardType, setExpiryDays, cardTypes)}
                        className={compactInputClassName}
                      >
                        <option value="">请选择套餐类型</option>
                        {cardTypes.map((cardType) => (
                          <option key={cardType.name} value={cardType.name}>
                            {cardType.name} ({cardType.description})
                          </option>
                        ))}
                      </AppSelect>
                    </DashboardFormField>
                    <DashboardFormField label="有效期（天）" htmlFor="generate-expiry-days">
                      <AppInput
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
                      <AppInput
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
                  <h2 className="text-xl font-semibold text-ink-50">本次生成的激活码</h2>
                  <button
                    onClick={() => exportCodes(generatedCodes)}
                    className={successButtonClassName}
                  >
                    导出CSV
                  </button>
                </div>

                <DashboardDataTable
                  headers={['项目', '激活码', '授权类型', '规格', '创建时间', '剩余次数', '操作']}
                  tableClassName="w-full min-w-[920px] divide-y divide-surface-200"
                >
                  {generatedCodes.map((code) => (
                    <tr key={code.id} className="transition hover:bg-surface-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-ink-400">{getProjectDisplay(code)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-ink-100">{code.code}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-ink-400">{getLicenseModeDisplay(code.licenseMode)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-ink-400">{getSpecDisplay(code)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-ink-400">{new Date(code.createdAt).toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-ink-400">{getRemainingDisplay(code)}</td>
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
            matchedCount={codeList.total}
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

        {activeTab === 'auditLogs' && (
          <AuditLogWorkspace
            activeTab={auditLogWorkspaceTab}
            onTabChange={handleChangeAuditLogWorkspaceTab}
            loading={auditLogLoading}
            matchedCount={auditLogPagination.total}
            operatorCoverage={auditLogOperatorCoverage}
            projectCoverage={auditLogProjectCoverage}
            filtersView={auditLogFiltersView}
            logsView={auditLogLogsView}
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

        {activeTab === 'shop' && <ShopAdminPanel />}
          </div>
        </div>
      </div>
    </div>
    </main>
  )
}
