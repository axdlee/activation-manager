'use client'

import React, { type ReactNode, useEffect, useState } from 'react'

import { DashboardDataTable } from '@/components/dashboard-data-table'
import { DashboardEmptyState } from '@/components/dashboard-empty-state'
import { DashboardFilterFieldCard } from '@/components/dashboard-filter-field-card'
import { DashboardInlineActionButton } from '@/components/dashboard-inline-action-button'
import { DashboardLoadingState } from '@/components/dashboard-loading-state'
import { DashboardModal } from '@/components/dashboard-modal'
import { DashboardPaginationBar } from '@/components/dashboard-pagination-bar'
import { DashboardSectionHeader } from '@/components/dashboard-section-header'
import { DashboardStatTile } from '@/components/dashboard-stat-tile'
import { DashboardSummaryStrip } from '@/components/dashboard-summary-strip'
import { DashboardTokenList } from '@/components/dashboard-token-list'
import { WorkspaceHeroPanel } from '@/components/workspace-hero-panel'
import { WorkspaceMetricCard } from '@/components/workspace-metric-card'
import { WorkspaceTabNav } from '@/components/workspace-tab-nav'
import {
  activationCodeWorkspaceTabs,
  type ActivationCodeWorkspaceTab,
} from '@/lib/dashboard-workspace-tabs'
import { type LicenseModeValue } from '@/lib/license-status'
import { useI18n } from '@/lib/i18n/i18n-provider'
import {
  getInheritedRebindPlaceholder,
  getInheritedRebindPolicyOptionLabel,
  getScopedRebindCooldownLabel,
  getScopedRebindMaxCountLabel,
  getScopedRebindPolicyLabel,
} from '@/lib/rebind-policy-ui'

type ActivationCodeStatusFilter = 'all' | 'unused' | 'used' | 'expired' | 'depleted'

type ActivationCodeWorkspaceProjectOption = {
  id: number
  name: string
  projectKey: string
}

type ActivationCodeWorkspaceCode = {
  id: number
  code: string
  licenseMode: LicenseModeValue
  createdAt: string
  usedAt: string | null
  usedBy: string | null
  lastBoundAt?: string | null
  lastRebindAt?: string | null
  rebindCount?: number
  autoRebindCount?: number
  allowAutoRebind?: boolean | null
  autoRebindCooldownMinutes?: number | null
  autoRebindMaxCount?: number | null
  bindingHistories?: Array<{
    id: number
    eventType: string
    operatorType: string
    operatorUsername?: string | null
    fromMachineId?: string | null
    toMachineId?: string | null
    reason?: string | null
    createdAt: string
  }>
  adminAuditLogs?: Array<{
    id: number
    adminUsername: string
    operationType: string
    targetLabel?: string | null
    reason?: string | null
    detailJson?: string | null
    createdAt: string
  }>
  project?: {
    id: number
    name: string
    projectKey: string
    allowAutoRebind?: boolean | null
    autoRebindCooldownMinutes?: number | null
    autoRebindMaxCount?: number | null
  } | null
}

type ActivationCodeTimelineEntry = {
  id: number
  title: string
  description: string
  timestamp: string
}

type ActivationCodeWorkspaceFiltersView = {
  searchTerm: string
  statusFilter: ActivationCodeStatusFilter
  projectFilter: string
  cardTypeFilter: string
  availableCardTypes: string[]
  projectOptions: ActivationCodeWorkspaceProjectOption[]
  filterTokens: string[]
  statusSummary: {
    unused: number
    inUse: number
    risk: number
  }
  onSearchTermChange: (value: string) => void
  onStatusFilterChange: (value: ActivationCodeStatusFilter) => void
  onProjectFilterChange: (value: string) => void
  onCardTypeFilterChange: (value: string) => void
  onReset: () => void
  onExport: () => void
}

type ActivationCodeManagementView = {
  selectedCodeId: number | null
  selectedCodeTitle: string
  selectedCodeSubtitle: string
  bindingDeviceDisplay: string
  usedAtDisplay: string
  lastBoundAtDisplay: string
  lastRebindAtDisplay: string
  rebindCountDisplay: string
  autoRebindCountDisplay: string
  effectivePolicySummary: string[]
  overridePolicyValue: string
  overrideCooldownMinutesValue: string
  overrideMaxCountValue: string
  targetMachineId: string
  adminActionReason: string
  bindingHistoryEntries: ActivationCodeTimelineEntry[]
  adminAuditEntries: ActivationCodeTimelineEntry[]
  loading: boolean
  onSelectCode: (id: number) => void
  onOverridePolicyChange: (value: string) => void
  onOverrideCooldownMinutesChange: (value: string) => void
  onOverrideMaxCountChange: (value: string) => void
  onTargetMachineIdChange: (value: string) => void
  onAdminActionReasonChange: (value: string) => void
  onSaveSettings: () => void
  onForceUnbind: () => void
  onForceRebind: () => void
}

type ActivationCodeWorkspaceResultsView<TCode extends ActivationCodeWorkspaceCode = ActivationCodeWorkspaceCode> = {
  filterTokens: string[]
  filteredCount: number
  startIndex: number
  endIndex: number
  currentPage: number
  totalPages: number
  codes: TCode[]
  managementView?: ActivationCodeManagementView
  onExport: () => void
  onCleanup: () => void
  onPageChange: (page: number) => void
  onCopyCode: (code: string) => void
  onDeleteCode: (id: number) => void
  getProjectDisplay: (code: TCode) => ReactNode
  getStatusBadge: (code: TCode) => ReactNode
  getLicenseModeDisplay: (mode: LicenseModeValue) => ReactNode
  getSpecDisplay: (code: TCode) => ReactNode
  getExpiryDisplay: (code: TCode) => ReactNode
  getRemainingDisplay: (code: TCode) => ReactNode
}

type ActivationCodeWorkspaceProps<TCode extends ActivationCodeWorkspaceCode = ActivationCodeWorkspaceCode> = {
  activeTab: ActivationCodeWorkspaceTab
  onTabChange: (tab: ActivationCodeWorkspaceTab) => void
  loading: boolean
  matchedCount: number
  projectCoverage: number
  riskCount: number
  filtersView: ActivationCodeWorkspaceFiltersView
  resultsView: ActivationCodeWorkspaceResultsView<TCode>
  panelClassName?: string
  workspaceSummaryCardClassName?: string
  compactInputClassName?: string
  primaryButtonClassName?: string
  successButtonClassName?: string
  warningButtonClassName?: string
  ghostButtonClassName?: string
  paginationButtonClassName?: string
  paginationActiveButtonClassName?: string
}

const defaultPanelClassName =
  'rounded-lg border border-border/70 bg-card shadow-card'
const defaultWorkspaceSummaryCardClassName =
  'rounded-lg border border-border bg-card px-4 py-4 shadow-sm'
const defaultCompactInputClassName =
  'w-full rounded-md border border-border bg-card px-4 py-2.5 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground focus:border-primary/50 focus:ring-4 focus:ring-primary/20 disabled:bg-card disabled:text-muted-foreground'
const defaultPrimaryButtonClassName =
  'inline-flex items-center justify-center rounded-md bg-ink-900 px-4 py-3 text-sm font-semibold text-white shadow-card transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50'
const defaultSuccessButtonClassName =
  'inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-card transition hover:-translate-y-0.5 hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50'
const defaultWarningButtonClassName =
  'inline-flex items-center justify-center rounded-md bg-amber-500 px-4 py-3 text-sm font-semibold text-white shadow-card transition hover:-translate-y-0.5 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50'
const defaultGhostButtonClassName =
  'inline-flex items-center justify-center rounded-md border border-border bg-card px-4 py-3 text-sm font-medium text-foreground/80 shadow-sm transition hover:-translate-y-0.5 hover:border-input hover:bg-card disabled:cursor-not-allowed disabled:opacity-50'
const defaultPaginationButtonClassName =
  'inline-flex h-10 min-w-[2.5rem] items-center justify-center rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground/80 shadow-sm transition hover:-translate-y-0.5 hover:border-input hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50'
const defaultPaginationActiveButtonClassName =
  'border-sky-500 bg-brand-500 text-white shadow-card hover:border-sky-500 hover:bg-brand-500'

type ActivationCodeManagementPanelProps = {
  managementView: ActivationCodeManagementView
  compactInputClassName: string
  primaryButtonClassName: string
  warningButtonClassName: string
  t: (key: string, fallback?: string) => string
}

function ActivationCodeManagementPanel({
  managementView,
  compactInputClassName,
  primaryButtonClassName,
  warningButtonClassName,
  t,
}: ActivationCodeManagementPanelProps) {
  if (managementView.selectedCodeId === null) {
    return (
      <DashboardEmptyState
        message={t(
          'codews.managementEmpty',
          '选择一条激活码后，可在弹框中查看绑定设备、最终生效策略并执行强制解绑或换绑。',
        )}
      />
    )
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-card px-5 py-4 shadow-sm">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {t('codews.currentSelection', '当前选中')}
        </div>
        <div className="mt-3 text-xl font-semibold text-foreground">{managementView.selectedCodeTitle}</div>
        <div className="mt-2 text-sm text-muted-foreground">{managementView.selectedCodeSubtitle}</div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        {[
          [t('codews.fieldDevice', '绑定设备'), managementView.bindingDeviceDisplay],
          [t('codews.fieldFirstUsed', '首次使用'), managementView.usedAtDisplay],
          [t('codews.fieldLastBound', '最近绑定'), managementView.lastBoundAtDisplay],
          [t('codews.fieldLastRebind', '最近换绑'), managementView.lastRebindAtDisplay],
          [t('codews.fieldRebindCount', '换绑次数'), managementView.rebindCountDisplay],
          [t('codews.fieldAutoRebindCount', '自助换绑次数'), managementView.autoRebindCountDisplay],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-lg border border-border bg-card px-4 py-4 shadow-sm"
          >
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
            <div className="mt-3 text-sm font-medium text-foreground">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr]">
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="text-sm font-semibold text-foreground">{t('codews.effectivePolicyTitle', '最终生效策略')}</div>
          <ul className="mt-4 space-y-2 text-sm text-foreground/80">
            {managementView.effectivePolicySummary.map((item) => (
              <li key={item} className="rounded-md border border-border bg-muted/50 px-4 py-3">
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="text-sm font-semibold text-foreground">{t('codews.overrideTitle', '单码级覆盖配置')}</div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {t('codews.overrideDescription', '这里是单码级覆盖层；若保持继承，会先回退项目级策略，项目未配置时再回退系统级策略。')}
          </p>
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="activation-code-override-policy" className="text-sm font-medium text-foreground/90">
                {getScopedRebindPolicyLabel('code')}
              </label>
              <select
                id="activation-code-override-policy"
                value={managementView.overridePolicyValue}
                onChange={(event) => managementView.onOverridePolicyChange(event.target.value)}
                className={`${compactInputClassName} mt-2`}
              >
                <option value="inherit">{getInheritedRebindPolicyOptionLabel('code')}</option>
                <option value="enabled">{t('codews.rebindPolicyEnabled', '允许自助换绑')}</option>
                <option value="disabled">{t('codews.rebindPolicyDisabled', '禁止自助换绑')}</option>
              </select>
            </div>
            <div>
              <label htmlFor="activation-code-override-cooldown" className="text-sm font-medium text-foreground/90">
                {getScopedRebindCooldownLabel('code')}
              </label>
              <input
                id="activation-code-override-cooldown"
                type="number"
                min="0"
                value={managementView.overrideCooldownMinutesValue}
                onChange={(event) => managementView.onOverrideCooldownMinutesChange(event.target.value)}
                className={`${compactInputClassName} mt-2`}
                placeholder={getInheritedRebindPlaceholder('code', 'cooldown')}
              />
            </div>
            <div>
              <label htmlFor="activation-code-override-max-count" className="text-sm font-medium text-foreground/90">
                {getScopedRebindMaxCountLabel('code')}
              </label>
              <input
                id="activation-code-override-max-count"
                type="number"
                min="0"
                value={managementView.overrideMaxCountValue}
                onChange={(event) => managementView.onOverrideMaxCountChange(event.target.value)}
                className={`${compactInputClassName} mt-2`}
                placeholder={getInheritedRebindPlaceholder('code', 'maxCount')}
              />
            </div>
            <button
              type="button"
              onClick={managementView.onSaveSettings}
              disabled={managementView.loading}
              className={`w-full ${primaryButtonClassName}`}
            >
              {t('codews.saveOverride', '保存单码级换绑配置')}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm xl:col-span-2">
          <div className="text-sm font-semibold text-foreground">{t('codews.adminReasonTitle', '管理员操作说明（选填）')}</div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {t('codews.adminReasonDescription', '会随“保存单码级换绑配置 / 强制解绑 / 强制换绑”一起写入审计日志，建议记录工单号、用户申请原因或排障背景。')}
          </p>
          <textarea
            value={managementView.adminActionReason}
            onChange={(event) => managementView.onAdminActionReasonChange(event.target.value)}
            className={`${compactInputClassName} mt-4 min-h-[104px] resize-y`}
            placeholder={t('codews.adminReasonPlaceholder', '例如：用户更换电脑，已核对订单并批准迁移')}
          />
        </div>

        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="text-sm font-semibold text-foreground">{t('codews.forceUnbind', '强制解绑')}</div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {t('codews.forceUnbindDescription', '只释放当前设备绑定，不重置有效期、剩余次数或使用时间。')}
          </p>
          <button
            type="button"
            onClick={managementView.onForceUnbind}
            disabled={managementView.loading}
            className={`mt-4 w-full ${warningButtonClassName}`}
          >
            {t('codews.forceUnbind', '强制解绑')}
          </button>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="text-sm font-semibold text-foreground">{t('codews.forceRebind', '强制换绑')}</div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {t('codews.forceRebindDescription', '将当前激活码直接迁移到新设备，同时保留原有效期、次数与生命周期。')}
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={managementView.targetMachineId}
              onChange={(event) => managementView.onTargetMachineIdChange(event.target.value)}
              className={compactInputClassName}
              placeholder={t('codews.machineIdPlaceholder', '输入目标 machineId')}
            />
            <button
              type="button"
              onClick={managementView.onForceRebind}
              disabled={managementView.loading}
              className={primaryButtonClassName}
            >
              {t('codews.forceRebind', '强制换绑')}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="text-sm font-semibold text-foreground">{t('codews.bindingHistoryTitle', '绑定历史')}</div>
          <div className="mt-4 space-y-3">
            {managementView.bindingHistoryEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('codews.noBindingHistory', '暂无绑定历史记录')}</p>
            ) : (
              managementView.bindingHistoryEntries.map((item) => (
                <div
                  key={item.id}
                  className="rounded-md border border-border bg-muted/50 px-4 py-3"
                >
                  <div className="text-sm font-medium text-foreground">{item.title}</div>
                  <div className="mt-1 text-sm text-foreground/80">{item.description}</div>
                  <div className="mt-2 text-xs text-muted-foreground">{item.timestamp}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="text-sm font-semibold text-foreground">{t('codews.auditTitle', '管理员审计')}</div>
          <div className="mt-4 space-y-3">
            {managementView.adminAuditEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('codews.noAuditRecords', '暂无管理员操作记录')}</p>
            ) : (
              managementView.adminAuditEntries.map((item) => (
                <div
                  key={item.id}
                  className="rounded-md border border-border bg-muted/50 px-4 py-3"
                >
                  <div className="text-sm font-medium text-foreground">{item.title}</div>
                  <div className="mt-1 text-sm text-foreground/80">{item.description}</div>
                  <div className="mt-2 text-xs text-muted-foreground">{item.timestamp}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function ActivationCodeWorkspace<TCode extends ActivationCodeWorkspaceCode>({
  activeTab,
  onTabChange,
  loading,
  matchedCount,
  projectCoverage,
  riskCount,
  filtersView,
  resultsView,
  panelClassName = defaultPanelClassName,
  workspaceSummaryCardClassName = defaultWorkspaceSummaryCardClassName,
  compactInputClassName = defaultCompactInputClassName,
  primaryButtonClassName = defaultPrimaryButtonClassName,
  successButtonClassName = defaultSuccessButtonClassName,
  warningButtonClassName = defaultWarningButtonClassName,
  ghostButtonClassName = defaultGhostButtonClassName,
  paginationButtonClassName = defaultPaginationButtonClassName,
  paginationActiveButtonClassName = defaultPaginationActiveButtonClassName,
}: ActivationCodeWorkspaceProps<TCode>) {
  const { t } = useI18n()
  const [isManagementModalOpen, setIsManagementModalOpen] = useState(
    Boolean(resultsView.managementView?.selectedCodeId),
  )

  useEffect(() => {
    if (!resultsView.managementView || resultsView.managementView.selectedCodeId === null) {
      setIsManagementModalOpen(false)
    }
  }, [resultsView.managementView, resultsView.managementView?.selectedCodeId])

  const handleOpenManagement = (codeId: number) => {
    resultsView.managementView?.onSelectCode(codeId)
    setIsManagementModalOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className={panelClassName}>
        <WorkspaceHeroPanel
          badge={t('codews.badge', '激活码工作区')}
          title={t('codews.title', '激活码管理中心')}
          description={t('codews.description', '集中查看激活码状态与剩余信息，单码的绑定详情和管理操作可随时展开处理。')}
          gradientClassName="bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.1),transparent_30%)]"
          metrics={
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <WorkspaceMetricCard
                label={t('codews.matchedLabel', '当前匹配')}
                value={matchedCount}
                description={t('codews.matchedDescription', '筛选后的激活码记录总数')}
                className={workspaceSummaryCardClassName}
              />
              <WorkspaceMetricCard
                label={t('codews.coverageLabel', '覆盖项目')}
                value={projectCoverage}
                description={t('codews.coverageDescription', '当前结果涉及的项目数')}
                className={workspaceSummaryCardClassName}
              />
              <WorkspaceMetricCard
                label={t('codews.riskLabel', '风险项')}
                value={riskCount}
                description={t('codews.riskDescription', '已过期或已耗尽的记录')}
                className={workspaceSummaryCardClassName}
              />
            </div>
          }
          tabs={
            <WorkspaceTabNav
              tabs={activationCodeWorkspaceTabs}
              activeTab={activeTab}
              onChange={onTabChange}
            />
          }
        />
      </div>

      {activeTab === 'filters' ? (
        <div className={`${panelClassName} p-6`}>
          <DashboardSectionHeader
            title={t('codews.filtersTitle', '筛选与导出')}
            description={t('codews.filtersDescription', '按关键词、状态、项目与套餐快速定位激活码，组合筛选更精准。')}
            trailing={
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={filtersView.onReset}
                  disabled={filtersView.filterTokens.length === 0}
                  className={ghostButtonClassName}
                >
                  {t('codews.resetFilters', '重置筛选')}
                </button>
                <button
                  type="button"
                  onClick={() => onTabChange('results')}
                  className={primaryButtonClassName}
                >
                  {t('codews.viewResults', '查看结果列表')}
                </button>
              </div>
            }
          />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
            <DashboardFilterFieldCard
              label={t('codews.searchLabel', '搜索激活码或机器ID')}
              description={t('codews.searchDescription', '支持按激活码正文与绑定机器标识快速缩小范围。')}
              htmlFor="activation-code-search-term"
            >
              <input
                id="activation-code-search-term"
                type="text"
                value={filtersView.searchTerm}
                onChange={(event) => filtersView.onSearchTermChange(event.target.value)}
                className={compactInputClassName}
                placeholder={t('codews.searchPlaceholder', '输入激活码或机器ID')}
              />
            </DashboardFilterFieldCard>

            <DashboardFilterFieldCard
              label={t('codews.statusFilterLabel', '状态筛选')}
              description={t('codews.statusFilterDescription', '快速区分未激活、使用中、过期和次数耗尽状态。')}
              htmlFor="activation-code-status-filter"
            >
              <select
                id="activation-code-status-filter"
                value={filtersView.statusFilter}
                onChange={(event) =>
                  filtersView.onStatusFilterChange(event.target.value as ActivationCodeStatusFilter)
                }
                className={compactInputClassName}
              >
                <option value="all">{t('codews.statusAll', '全部状态')}</option>
                <option value="unused">{t('codews.statusUnused', '未激活')}</option>
                <option value="used">{t('codews.statusUsed', '已使用 / 使用中')}</option>
                <option value="expired">{t('codews.statusExpired', '已过期')}</option>
                <option value="depleted">{t('codews.statusDepleted', '已耗尽')}</option>
              </select>
            </DashboardFilterFieldCard>

            <DashboardFilterFieldCard
              label={t('codews.projectFilterLabel', '项目筛选')}
              description={t('codews.projectFilterDescription', '当你有多个项目时，可以只观察某一条业务线的发码结果。')}
              htmlFor="activation-code-project-filter"
            >
              <select
                id="activation-code-project-filter"
                value={filtersView.projectFilter}
                onChange={(event) => filtersView.onProjectFilterChange(event.target.value)}
                className={compactInputClassName}
              >
                <option value="all">{t('codews.projectAll', '全部项目')}</option>
                {filtersView.projectOptions.map((project) => (
                  <option key={project.id} value={project.projectKey}>
                    {project.name}
                  </option>
                ))}
              </select>
            </DashboardFilterFieldCard>

            <DashboardFilterFieldCard
              label={t('codews.cardTypeLabel', '套餐类型')}
              description={t('codews.cardTypeDescription', '适合将周卡、月卡、自定义天数与无套餐记录分别查看。')}
              htmlFor="activation-code-card-type-filter"
            >
              <select
                id="activation-code-card-type-filter"
                value={filtersView.cardTypeFilter}
                onChange={(event) => filtersView.onCardTypeFilterChange(event.target.value)}
                className={compactInputClassName}
              >
                <option value="all">{t('codews.cardTypeAll', '全部套餐')}</option>
                {filtersView.availableCardTypes.map((cardType) => (
                  <option key={cardType} value={cardType}>
                    {cardType}
                  </option>
                ))}
                <option value="none">{t('codews.cardTypeNone', '无套餐类型')}</option>
              </select>
            </DashboardFilterFieldCard>

            <DashboardFilterFieldCard
              label={t('codews.exportCardLabel', '导出当前结果')}
              description={t('codews.exportCardDescription', '基于当前筛选条件导出 CSV，适合对账、转交和离线留档。')}
            >
              <button
                type="button"
                onClick={filtersView.onExport}
                disabled={matchedCount === 0}
                className={`w-full ${successButtonClassName}`}
              >
                {t('codews.exportFiltered', '导出筛选结果')}
              </button>
            </DashboardFilterFieldCard>
          </div>

          <div className="mt-5 rounded-lg border border-border bg-card p-5 shadow-card">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {t('codews.activeFilters', '当前生效条件')}
                </div>
                <DashboardTokenList
                  tokens={filtersView.filterTokens}
                  emptyText={t('codews.noFilters', '当前未设置任何筛选条件')}
                  className="mt-3 flex flex-wrap gap-2"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <DashboardStatTile
                  label={t('codews.summaryUnused', '未激活')}
                  value={filtersView.statusSummary.unused}
                  description={t('codews.summaryUnusedDescription', '尚未完成首次绑定')}
                />
                <DashboardStatTile
                  label={t('codews.summaryBound', '已绑定')}
                  value={filtersView.statusSummary.inUse}
                  description={t('codews.summaryBoundDescription', '已进入使用中或已使用状态')}
                />
                <DashboardStatTile
                  label={t('codews.summaryRisk', '风险项')}
                  value={filtersView.statusSummary.risk}
                  description={t('codews.summaryRiskDescription', '已过期或次数已耗尽')}
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className={`${panelClassName} p-6`}>
            <DashboardSectionHeader
              title={t('codews.listTitle', '激活码列表 ({count} 条记录)').replace(
                '{count}',
                String(resultsView.filteredCount),
              )}
              description={t('codews.listDescription', '查看当前页激活码明细，可复制、删除或清理过期绑定。')}
              trailing={
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => onTabChange('filters')}
                    className={ghostButtonClassName}
                  >
                    {t('codews.viewFilters', '查看筛选器')}
                  </button>
                  <button
                    type="button"
                    onClick={resultsView.onExport}
                    disabled={resultsView.filteredCount === 0}
                    className={successButtonClassName}
                  >
                    {t('codews.exportFiltered', '导出筛选结果')}
                  </button>
                  <button
                    type="button"
                    onClick={resultsView.onCleanup}
                    disabled={loading}
                    className={warningButtonClassName}
                  >
                    {t('codews.cleanupExpired', '清理过期绑定')}
                  </button>
                </div>
              }
              className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"
            />

            <DashboardSummaryStrip
              leading={
                <DashboardTokenList
                  tokens={resultsView.filterTokens}
                  emptyText={t('codews.showAllCodes', '当前显示全部激活码')}
                />
              }
              trailing={
                <div className="text-sm text-muted-foreground">
                  {t('codews.pageSummary', '当前展示第 {start} - {end} 条，共 {total} 条记录')
                    .replace('{start}', String(resultsView.startIndex))
                    .replace('{end}', String(resultsView.endIndex))
                    .replace('{total}', String(resultsView.filteredCount))}
                </div>
              }
            />

            {loading ? (
              <DashboardLoadingState message={t('codews.loading', '加载中...')} />
            ) : (
              <>
                <DashboardDataTable
                  headers={[
                    t('codews.columnProject', '项目'),
                    t('codews.columnCode', '激活码'),
                    t('codews.columnStatus', '状态'),
                    t('codews.columnLicenseMode', '授权类型'),
                    t('codews.columnSpec', '规格'),
                    t('codews.columnCreatedAt', '创建时间'),
                    t('codews.columnExpiresAt', '过期时间'),
                    t('codews.columnRemaining', '剩余次数'),
                    t('codews.columnUsedAt', '使用时间'),
                    t('codews.columnDevice', '绑定设备 / machineId'),
                    t('codews.columnActions', '操作'),
                  ]}
                  tableClassName="w-full min-w-[1460px] divide-y divide-surface-200"
                >
                  {resultsView.codes.map((code) => {
                    const isSelected = resultsView.managementView?.selectedCodeId === code.id

                    return (
                      <tr key={code.id} className="transition hover:bg-muted/50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          {resultsView.getProjectDisplay(code)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-foreground">
                          {code.code}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {resultsView.getStatusBadge(code)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          {resultsView.getLicenseModeDisplay(code.licenseMode)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          {resultsView.getSpecDisplay(code)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          {new Date(code.createdAt).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          {resultsView.getExpiryDisplay(code)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          {resultsView.getRemainingDisplay(code)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          {code.usedAt ? new Date(code.usedAt).toLocaleString() : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          {code.usedBy || t('codews.unbound', '未绑定')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex flex-wrap gap-2">
                            <DashboardInlineActionButton
                              onClick={() => resultsView.onCopyCode(code.code)}
                            >
                              {t('codews.copy', '复制')}
                            </DashboardInlineActionButton>
                            <DashboardInlineActionButton
                              onClick={() => handleOpenManagement(code.id)}
                              className={`inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 ${
                                isSelected
                                  ? 'border-primary/25 bg-primary/10 text-primary'
                                  : 'border-border bg-card text-foreground/80 hover:border-input hover:bg-muted/50'
                              }`}
                            >
                              {t('codews.viewManage', '查看 / 管理')}
                            </DashboardInlineActionButton>
                            <DashboardInlineActionButton
                              onClick={() => resultsView.onDeleteCode(code.id)}
                            >
                              {t('codews.delete', '删除')}
                            </DashboardInlineActionButton>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </DashboardDataTable>

                {resultsView.filteredCount === 0 ? (
                  <DashboardEmptyState
                    message={t(
                      'codews.emptyCodes',
                      '暂无匹配的激活码记录，建议切换到“筛选与导出”检查关键词、项目或套餐条件。',
                    )}
                    className="mt-5"
                  />
                ) : null}

                <DashboardPaginationBar
                  currentPage={resultsView.currentPage}
                  totalPages={resultsView.totalPages}
                  summary={t('codews.paginationSummary', '显示第 {start} - {end} 条，共 {total} 条记录')
                    .replace('{start}', String(resultsView.startIndex))
                    .replace('{end}', String(resultsView.endIndex))
                    .replace('{total}', String(resultsView.filteredCount))}
                  onPageChange={resultsView.onPageChange}
                  buttonClassName={paginationButtonClassName}
                  activeButtonClassName={paginationActiveButtonClassName}
                />
              </>
            )}
          </div>

          {resultsView.managementView ? (
            <DashboardModal
              open={isManagementModalOpen}
              onClose={() => setIsManagementModalOpen(false)}
              title={
                resultsView.managementView.selectedCodeId === null
                  ? t('codews.manageTitle', '单码管理')
                  : `${t('codews.manageTitle', '单码管理')} · ${resultsView.managementView.selectedCodeTitle}`
              }
              description={t('codews.manageDescription', '查看绑定设备、最终生效策略、单码级覆盖配置与管理员操作审计。')}
              size="6xl"
            >
              <ActivationCodeManagementPanel
                managementView={resultsView.managementView}
                compactInputClassName={compactInputClassName}
                primaryButtonClassName={primaryButtonClassName}
                warningButtonClassName={warningButtonClassName}
                t={t}
              />
            </DashboardModal>
          ) : null}
        </>
      )}
    </div>
  )
}
