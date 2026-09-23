'use client'

import React, { useEffect, useMemo, useState } from 'react'

import { DashboardEmptyState } from '@/components/dashboard-empty-state'
import { DashboardLoadingState } from '@/components/dashboard-loading-state'
import { WorkspaceTabNav } from '@/components/workspace-tab-nav'
import { useI18n } from '@/lib/i18n/i18n-provider'
import {
  buildSystemConfigWorkspaceTabs,
  type SystemConfigWorkspaceTab,
} from '@/lib/dashboard-workspace-tabs'
import {
  type SystemConfigPageModel,
  type SystemConfigValue,
} from '@/lib/system-config-ui'
import {
  renderGroupSection,
  resolveInitialTab,
  systemConfigGroupThemeMap,
  type NotifyChannelTab,
} from './system-config-sections'

type SystemConfigWorkspaceProps = {
  pageModel: SystemConfigPageModel
  systemConfigsCount: number
  sensitiveCount: number
  whitelistEntryCount: number
  loading: boolean
  inputClassName: string
  panelClassName?: string
  initialTab?: SystemConfigWorkspaceTab
  /** false = 隐藏内部摘要 chips + 分区导航（设置页左导航接管） */
  showHeader?: boolean
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  updateConfigValue: (key: string, value: SystemConfigValue) => void
  toggleSensitiveConfigVisibility: (key: string) => void
  isSensitiveConfigVisible: (key: string) => boolean
}


const overviewChecklistItems = [
  { key: 'sysconfws.checklist.jwtSecret', fallback: '修改 JWT 密钥后，当前所有管理员会话都需要重新登录。' },
  {
    key: 'sysconfws.checklist.whitelist',
    fallback: '调整 IP 白名单前，请确认当前访问 IP 已被包含，避免把自己锁在系统外。',
  },
  {
    key: 'sysconfws.checklist.rebindPriority',
    fallback: '系统级换绑策略只提供默认值，最终生效优先级仍然是：系统级配置 < 项目级配置 < 单码级配置。',
  },
  {
    key: 'sysconfws.checklist.bcrypt',
    fallback: '提升 bcrypt 轮数会增强安全性，但登录与改密耗时也会增加。',
  },
]

const overviewActionButtonClassName =
  'inline-flex items-center justify-center rounded-md border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground/80 shadow-sm transition hover:-translate-y-0.5 hover:border-input hover:bg-muted/50'


export function SystemConfigWorkspace({
  pageModel,
  systemConfigsCount,
  sensitiveCount,
  whitelistEntryCount,
  loading,
  inputClassName,
  panelClassName =
    'rounded-lg border border-border/70 bg-card shadow-card',
  initialTab = 'overview',
  /** false = 隐藏内部摘要 chips + 分区导航（由设置页左侧导航接管，Task 8 布局升级） */
  showHeader = true,
  onSubmit,
  updateConfigValue,
  toggleSensitiveConfigVisibility,
  isSensitiveConfigVisible,
}: SystemConfigWorkspaceProps) {
  const { t } = useI18n()

  const handleScanExpired = async () => {
    setScanningExpired(true)
    setScanMessage('')
    try {
      const response = await fetch('/api/admin/notifications/scan-expired', { method: 'POST' })
      const data = (await response.json()) as { success: boolean; message?: string }
      if (!data.success) {
        setScanMessage(data.message ?? t('sysconfws.scan.failed', '扫描失败'))
        return
      }
      setScanMessage(data.message ?? t('sysconfws.scan.completed', '扫描完成'))
    } catch {
      setScanMessage(t('sysconfws.scan.failedRetry', '扫描失败，请稍后重试'))
    } finally {
      setScanningExpired(false)
    }
  }

  const workspaceTabs = useMemo(
    () => buildSystemConfigWorkspaceTabs(pageModel.groups),
    [pageModel.groups],
  )
  const workspaceTabKeySet = useMemo(
    () => new Set(workspaceTabs.map((tab) => tab.key)),
    [workspaceTabs],
  )
  const resolvedInitialTab = useMemo(
    () => resolveInitialTab(initialTab, workspaceTabs),
    [initialTab, workspaceTabs],
  )
  const [activeTab, setActiveTab] = useState<SystemConfigWorkspaceTab>(resolvedInitialTab)
  const [notifyChannelTab, setNotifyChannelTab] = useState<NotifyChannelTab>('webhook')
  const [scanningExpired, setScanningExpired] = useState(false)
  const [scanMessage, setScanMessage] = useState('')

  useEffect(() => {
    setActiveTab((currentTab) =>
      workspaceTabKeySet.has(currentTab) ? currentTab : resolvedInitialTab,
    )
  }, [resolvedInitialTab, workspaceTabKeySet])

  const activeGroup =
    activeTab === 'overview'
      ? null
      : pageModel.groups.find((group) => group.key === activeTab) || null

  return (
    <div className="space-y-6 pb-10">
      {showHeader ? (
        <section className={`${panelClassName} p-6 sm:p-7`}>
          <div className="flex flex-wrap gap-2">
            {pageModel.summaryCards.map((card) => (
              <span
                key={card.label}
                className="rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground"
              >
                {card.label}：{card.value}
              </span>
            ))}
          </div>

          <div className="mt-5">
            <WorkspaceTabNav tabs={workspaceTabs} activeTab={activeTab} onChange={setActiveTab} />
          </div>
        </section>
      ) : null}

      {loading && pageModel.groups.length === 0 ? (
        <div className={panelClassName}>
          <DashboardLoadingState
            message={t('sysconfws.state.loading', '正在加载系统配置...')}
            className="py-10 text-center"
          />
        </div>
      ) : pageModel.groups.length === 0 ? (
        <DashboardEmptyState
          className={panelClassName}
          message={t('sysconfws.state.empty', '暂无系统配置数据')}
        />
      ) : activeGroup ? (
        <form id="system-config-form" onSubmit={onSubmit} className="space-y-6">
          {renderGroupSection({
            group: activeGroup,
            notifyChannelTab,
            onNotifyChannelTabChange: setNotifyChannelTab,
            panelClassName,
            inputClassName,
            updateConfigValue,
            toggleSensitiveConfigVisibility,
            isSensitiveConfigVisible,
            t,
          })}

          <section className={`${panelClassName} p-5`}>
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="inline-flex items-center rounded-full border border-border bg-muted/50 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-foreground/80">
                  {t('sysconfws.save.badge', '保存后立即生效')}
                </div>
                <h3 className="mt-3 text-lg font-semibold text-foreground">
                  {t('sysconfws.save.title', '准备保存本次配置变更？')}
                </h3>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {t('sysconfws.save.description', '保存后配置立即生效，涉及访问控制与认证的变更会马上影响后台行为。')}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                    {t('sysconfws.badge.itemsCount', '项配置').replace('{count}', String(systemConfigsCount))}
                  </span>
                  <span className="rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                    {t('sysconfws.badge.sensitiveCount', '个敏感项').replace('{count}', String(sensitiveCount))}
                  </span>
                  <span className="rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                    {t('sysconfws.badge.whitelistAddresses', '个白名单地址').replace('{count}', String(whitelistEntryCount))}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center rounded-md bg-brand-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
              >
                {loading ? t('sysconfws.action.saving', '保存中...') : t('sysconfws.action.saveConfig', '保存配置')}
              </button>
              <button
                type="button"
                onClick={() => void handleScanExpired()}
                disabled={scanningExpired}
                className="inline-flex w-full items-center justify-center rounded-md border border-border bg-card px-5 py-3 text-sm font-medium text-foreground/80 transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
              >
                {scanningExpired
                  ? t('sysconfws.action.scanning', '扫描中...')
                  : t('sysconfws.action.scanExpired', '扫描到期通知')}
              </button>
            </div>
            {scanMessage ? (
              <p className="mt-2 text-sm text-muted-foreground">{scanMessage}</p>
            ) : null}
          </section>
        </form>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className={`${panelClassName} p-6`}>
            <div className="mb-5">
              <div className="inline-flex items-center rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-foreground/80">
                {t('sysconfws.overview.badge', '配置总览')}
              </div>
              <h3 className="mt-4 text-xl font-semibold text-foreground">
                {t('sysconfws.overview.title', '先确认这些关键影响')}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t('sysconfws.overview.description', '所有配置更改即时生效，建议从影响面最大的项目开始调整。')}
              </p>
            </div>

            <div className="space-y-3">
              {overviewChecklistItems.map((item, index) => (
                <div
                  key={item.key}
                  className="rounded-md border border-border bg-muted/50 px-4 py-4 text-sm leading-7 text-foreground/80"
                >
                  <span className="mr-2 font-semibold text-foreground">0{index + 1}</span>
                  {t(item.key, item.fallback)}
                </div>
              ))}
            </div>

            <div className="mt-6 border-t border-border pt-6">
              <div className="mb-5">
                <div className="text-sm font-semibold text-foreground">
                  {t('sysconfws.overview.quickView', '分区速览')}
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {t(
                    'sysconfws.overview.quickViewDescription',
                    '先按影响面选择要进入的分区；进入后只显示该分区字段，页面更短，定位更快。',
                  )}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {pageModel.groups.map((group) => {
                  const groupTheme = systemConfigGroupThemeMap[group.key]

                  return (
                    <article
                      key={group.key}
                      className={`rounded-lg border p-5 shadow-sm ${groupTheme.summaryPanel}`}
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div
                            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold tracking-[0.18em] ${groupTheme.badge}`}
                          >
                            <span className={`h-2 w-2 rounded-full ${groupTheme.dot}`} />
                            {group.badge}
                          </div>
                          <h4 className={`mt-4 text-lg font-semibold ${groupTheme.title}`}>{group.title}</h4>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">{group.description}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => setActiveTab(group.key)}
                          className={overviewActionButtonClassName}
                        >
                          {t('sysconfws.action.enterSection', '进入分区')}
                        </button>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-2">
                        <span className="rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                          {t('sysconfws.badge.itemsCount', '项配置').replace('{count}', String(group.items.length))}
                        </span>
                        <span className="rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                          {t('sysconfws.badge.sensitiveCount', '个敏感项').replace('{count}', String(group.items.filter((item) => item.sensitive).length))}
                        </span>
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>
          </section>

          <section className={`${panelClassName} p-6`}>
            <div>
              <div className="inline-flex items-center rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-foreground/80">
                {t('sysconfws.saveMode.badge', '保存方式')}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-foreground">
                {t('sysconfws.saveMode.title', '按分区编辑，统一保存')}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t('sysconfws.saveMode.description', '从总览进入各分区，编辑完成后统一保存生效。')}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  {t('sysconfws.badge.itemsCount', '项配置').replace('{count}', String(systemConfigsCount))}
                </span>
                <span className="rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  {t('sysconfws.badge.sensitiveCount', '个敏感项').replace('{count}', String(sensitiveCount))}
                </span>
                <span className="rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  {t('sysconfws.badge.whitelistAddresses', '个白名单地址').replace('{count}', String(whitelistEntryCount))}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab(pageModel.groups[0]?.key || 'overview')}
                className="mt-5 inline-flex w-full items-center justify-center rounded-md bg-brand-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 lg:w-auto"
              >
                {t('sysconfws.action.goFirstSection', '前往首个分区')}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

