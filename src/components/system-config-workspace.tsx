'use client'

import React, { useEffect, useMemo, useState } from 'react'

import { DashboardEmptyState } from '@/components/dashboard-empty-state'
import { DashboardLoadingState } from '@/components/dashboard-loading-state'
import { WorkspaceTabNav } from '@/components/workspace-tab-nav'
import { AppInput } from '@/components/ui/app-input'
import { AppSelect } from '@/components/ui/app-select'
import { AppTextarea } from '@/components/ui/app-textarea'
import { useI18n } from '@/lib/i18n/i18n-provider'
import {
  buildSystemConfigWorkspaceTabs,
  type SystemConfigWorkspaceTab,
} from '@/lib/dashboard-workspace-tabs'
import {
  type SystemConfigGroup,
  type SystemConfigGroupKey,
  type SystemConfigPageModel,
  type SystemConfigValue,
  type SystemConfigDisplayItem,
} from '@/lib/system-config-ui'

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

const systemConfigBadgeClassNameMap = {
  info: 'border-primary/25 bg-primary/10 text-primary',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  danger: 'border-rose-200 bg-rose-50 text-rose-600',
  neutral: 'border-border bg-muted/50 text-foreground/80',
} as const

const systemConfigGroupThemeMap = {
  access: {
    badge: 'border border-border bg-muted/50 text-foreground/80',
    dot: 'bg-brand-500',
    title: 'text-foreground',
    note: 'border-border bg-muted/50 text-foreground/80',
    divider: 'border-border',
    summaryPanel: 'border-border bg-card',
  },
  rebind: {
    badge: 'border border-border bg-muted/50 text-foreground/80',
    dot: 'bg-emerald-500',
    title: 'text-foreground',
    note: 'border-border bg-muted/50 text-foreground/80',
    divider: 'border-border',
    summaryPanel: 'border-border bg-card',
  },
  security: {
    badge: 'border border-border bg-muted/50 text-foreground/80',
    dot: 'bg-violet-500',
    title: 'text-foreground',
    note: 'border-border bg-muted/50 text-foreground/80',
    divider: 'border-border',
    summaryPanel: 'border-border bg-card',
  },
  branding: {
    badge: 'border border-border bg-muted/50 text-foreground/80',
    dot: 'bg-amber-500',
    title: 'text-foreground',
    note: 'border-border bg-muted/50 text-foreground/80',
    divider: 'border-border',
    summaryPanel: 'border-border bg-card',
  },
  notification: {
    badge: 'border border-border bg-muted/50 text-foreground/80',
    dot: 'bg-sky-500',
    title: 'text-foreground',
    note: 'border-border bg-muted/50 text-foreground/80',
    divider: 'border-border',
    summaryPanel: 'border-border bg-card',
  },
  advanced: {
    badge: 'border border-border bg-muted/50 text-foreground/80',
    dot: 'bg-surface-500',
    title: 'text-foreground',
    note: 'border-border bg-muted/50 text-foreground/80',
    divider: 'border-border',
    summaryPanel: 'border-border bg-card',
  },
} as const

const systemConfigFocusNoteKeyMap: Record<SystemConfigGroupKey, string> = {
  access: 'sysconfws.focusNote.access',
  rebind: 'sysconfws.focusNote.rebind',
  security: 'sysconfws.focusNote.security',
  branding: 'sysconfws.focusNote.branding',
  notification: 'sysconfws.focusNote.notification',
  advanced: 'sysconfws.focusNote.advanced',
}

const systemConfigFocusNoteFallbackMap: Record<SystemConfigGroupKey, string> = {
  access: '修改白名单前先核对当前访问 IP，避免把自己锁在系统外。',
  rebind: '这里配置的是系统级默认策略，项目级与单码级可继续覆盖；建议结合冷却时间与次数上限一起审视。',
  security: '这里的修改会立即影响登录态与密码安全成本，建议优先复核。',
  branding: '展示项会直接出现在登录页和后台标题区，建议与实际产品名称保持一致。',
  notification: '通知渠道全部可选：Webhook、邮件、短信至少配置其一即可生效；敏感的 SMTP 授权码保存后不会回显。',
  advanced: '高级配置通常承载扩展项，变更前请先确认其消费方与默认回退逻辑。',
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

function resolveInitialTab(
  initialTab: SystemConfigWorkspaceTab,
  tabs: Array<{ key: SystemConfigWorkspaceTab }>,
) {
  return tabs.some((tab) => tab.key === initialTab) ? initialTab : 'overview'
}

// 通知渠道子分组：按 key 前缀把通知组的配置项拆分到各渠道 Tab（Webhook/邮件/短信）
type NotifyChannelTab = 'webhook' | 'email' | 'sms'

const NOTIFY_CHANNEL_TABS: Array<{
  key: NotifyChannelTab
  label: string
  prefixes: string[]
  enabledKey: string
}> = [
  { key: 'webhook', label: 'Webhook 通知', prefixes: ['notifyWebhook'], enabledKey: 'notifyWebhookUrl' },
  { key: 'email', label: '邮件通知（SMTP）', prefixes: ['notifyEmail'], enabledKey: 'notifyEmailSmtpHost' },
  { key: 'sms', label: '短信通知', prefixes: ['notifySms'], enabledKey: 'notifySmsApiUrl' },
]

function splitNotifyChannelItems(items: SystemConfigDisplayItem[]) {
  const buckets = new Map<NotifyChannelTab, SystemConfigDisplayItem[]>([
    ['webhook', []],
    ['email', []],
    ['sms', []],
  ])
  for (const item of items) {
    const channel = NOTIFY_CHANNEL_TABS.find((tab) => tab.prefixes.some((prefix) => item.key.startsWith(prefix)))
    buckets.get(channel?.key ?? 'webhook')!.push(item)
  }
  return buckets
}

function renderGroupSection({
  group,
  panelClassName,
  inputClassName,
  updateConfigValue,
  toggleSensitiveConfigVisibility,
  isSensitiveConfigVisible,
  notifyChannelTab,
  onNotifyChannelTabChange,
  t,
}: {
  group: SystemConfigGroup
  panelClassName: string
  inputClassName: string
  updateConfigValue: (key: string, value: SystemConfigValue) => void
  toggleSensitiveConfigVisibility: (key: string) => void
  isSensitiveConfigVisible: (key: string) => boolean
  notifyChannelTab: NotifyChannelTab
  onNotifyChannelTabChange: (tab: NotifyChannelTab) => void
  t: (key: string, fallback?: string) => string
}) {
  const groupTheme = systemConfigGroupThemeMap[group.key]

  return (
    <section className={`${panelClassName} p-6`}>
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold tracking-[0.18em] ${groupTheme.badge}`}
          >
            <span className={`h-2 w-2 rounded-full ${groupTheme.dot}`} />
            {t('sysconfws.badge.currentSection', '当前分区配置')}
          </div>
          <h3 className={`mt-4 text-xl font-semibold tracking-tight ${groupTheme.title}`}>
            {group.title}
          </h3>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">{group.description}</p>
          <div className={`mt-4 rounded-md border px-4 py-3 text-sm leading-6 ${groupTheme.note}`}>
            {t(systemConfigFocusNoteKeyMap[group.key], systemConfigFocusNoteFallbackMap[group.key])}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
            {t('sysconfws.badge.itemsCount', '项配置').replace('{count}', String(group.items.length))}
          </span>
          <span className="rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
            {t('sysconfws.badge.sensitiveCount', '个敏感项').replace('{count}', String(group.items.filter((item) => item.sensitive).length))}
          </span>
        </div>
      </div>

      {group.key === 'notification' ? (
        <NotifyChannelSection
          group={group}
          notifyChannelTab={notifyChannelTab}
          onNotifyChannelTabChange={onNotifyChannelTabChange}
          inputClassName={inputClassName}
          updateConfigValue={updateConfigValue}
          toggleSensitiveConfigVisibility={toggleSensitiveConfigVisibility}
          isSensitiveConfigVisible={isSensitiveConfigVisible}
          t={t}
        />
      ) : (
      <div className="space-y-4">
        {group.items.map((item) => (
          <article key={item.key} className="rounded-lg border border-border bg-card p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-base font-semibold text-foreground">{item.label}</h4>
                  {item.badges?.map((badge) => (
                    <span
                      key={`${item.key}-${badge.label}`}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${systemConfigBadgeClassNameMap[badge.tone]}`}
                    >
                      {badge.label}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
              </div>

              {item.sensitive ? (
                <button
                  type="button"
                  onClick={() => toggleSensitiveConfigVisibility(item.key)}
                  className="inline-flex items-center justify-center rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground/80 shadow-sm transition hover:border-input hover:bg-muted/50"
                >
                  {isSensitiveConfigVisible(item.key)
                    ? t('sysconfws.action.hideContent', '隐藏内容')
                    : t('sysconfws.action.showContent', '显示内容')}
                </button>
              ) : null}
            </div>

            <div className="mt-4 space-y-4">
              {item.inputKind === 'textarea' ? (
                <AppTextarea
                  value={Array.isArray(item.value) ? item.value.join('\n') : String(item.value || '')}
                  onChange={(event) => {
                    const ips = event.target.value
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
                <AppInput
                  type="number"
                  min={item.min}
                  max={item.max}
                  step={item.step}
                  value={
                    typeof item.value === 'number'
                      ? item.value
                      : Number.parseInt(String(item.value ?? item.min ?? 0), 10)
                  }
                  onChange={(event) => {
                    const nextValue = Number.parseInt(event.target.value, 10)
                    updateConfigValue(item.key, Number.isNaN(nextValue) ? (item.min ?? 0) : nextValue)
                  }}
                  className={inputClassName}
                />
              ) : item.inputKind === 'select' ? (
                <AppSelect
                  value={String(item.value)}
                  onChange={(event) =>
                    updateConfigValue(
                      item.key,
                      event.target.value === 'true'
                        ? true
                        : event.target.value === 'false'
                          ? false
                          : event.target.value,
                    )
                  }
                  className={inputClassName}
                >
                  {item.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </AppSelect>
              ) : (
                <AppInput
                  type={
                    item.inputKind === 'password'
                      ? isSensitiveConfigVisible(item.key)
                        ? 'text'
                        : 'password'
                      : 'text'
                  }
                  value={String(item.value ?? '')}
                  onChange={(event) => updateConfigValue(item.key, event.target.value)}
                  className={`${inputClassName} ${item.sensitive ? 'font-mono tracking-[0.08em]' : ''}`}
                  placeholder={item.placeholder}
                />
              )}

              {item.previewTokens ? (
                <div className="rounded-md border border-border bg-muted/50 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {t('sysconfws.label.whitelistPreview', '当前白名单预览')}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.previewTokens.length > 0 ? (
                      item.previewTokens.map((token) => (
                        <span
                          key={`${item.key}-${token}`}
                          className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary"
                        >
                          {token}
                        </span>
                      ))
                    ) : (
                      <span className="rounded-full border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground">
                        {t('sysconfws.label.whitelistPreviewEmpty', '尚未填写 IP 地址')}
                      </span>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div className={`mt-4 rounded-lg border px-4 py-3 ${groupTheme.note}`}>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {t('sysconfws.label.hint', '操作建议')}
              </div>
              <div className="text-sm leading-6">{item.hint}</div>
            </div>
          </article>
        ))}
      </div>
      )}
    </section>
  )
}

// 通知渠道子 Tab 渲染（Webhook / 邮件 / 短信 各自独立成页，字段不再混排）
function NotifyChannelSection({
  group,
  notifyChannelTab,
  onNotifyChannelTabChange,
  inputClassName,
  updateConfigValue,
  toggleSensitiveConfigVisibility,
  isSensitiveConfigVisible,
  t,
}: {
  group: SystemConfigGroup
  notifyChannelTab: NotifyChannelTab
  onNotifyChannelTabChange: (tab: NotifyChannelTab) => void
  inputClassName: string
  updateConfigValue: (key: string, value: SystemConfigValue) => void
  toggleSensitiveConfigVisibility: (key: string) => void
  isSensitiveConfigVisible: (key: string) => boolean
  t: (key: string, fallback?: string) => string
}) {
  const buckets = splitNotifyChannelItems(group.items)
  const activeTab = NOTIFY_CHANNEL_TABS.find((tab) => tab.key === notifyChannelTab) ?? NOTIFY_CHANNEL_TABS[0]
  const channelItems = buckets.get(activeTab.key) ?? []

  const isChannelEnabled = (tab: (typeof NOTIFY_CHANNEL_TABS)[number]) => {
    const trigger = group.items.find((item) => item.key === tab.enabledKey)
    if (!trigger) return false
    const value = trigger.value
    return typeof value === 'string' ? value.trim().length > 0 : Array.isArray(value) ? value.length > 0 : Boolean(value)
  }

  return (
    <div>
      <div role="tablist" aria-label={t('sysconfws.notify.tabs', '通知渠道')} className="mb-4 flex flex-wrap gap-2">
        {NOTIFY_CHANNEL_TABS.map((tab) => {
          const isActive = tab.key === activeTab.key
          const enabled = isChannelEnabled(tab)
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onNotifyChannelTabChange(tab.key)}
              className={`inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition ${
                isActive
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {tab.label}
              <span
                className={`h-1.5 w-1.5 rounded-full ${enabled ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`}
                title={enabled ? t('sysconfws.notify.enabled', '已启用') : t('sysconfws.notify.disabled', '未启用')}
              />
            </button>
          )
        })}
      </div>

      <div className="space-y-4">
        {channelItems.map((item) => (
          <article key={item.key} className="rounded-lg border border-border bg-card p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-base font-semibold text-foreground">{item.label}</h4>
                  {item.badges?.map((badge) => (
                    <span
                      key={`${item.key}-${badge.label}`}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${systemConfigBadgeClassNameMap[badge.tone]}`}
                    >
                      {badge.label}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
              </div>

              {item.sensitive ? (
                <button
                  type="button"
                  onClick={() => toggleSensitiveConfigVisibility(item.key)}
                  className="inline-flex items-center justify-center rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground/80 shadow-sm transition hover:border-input hover:bg-muted/50"
                >
                  {isSensitiveConfigVisible(item.key)
                    ? t('sysconfws.action.hideContent', '隐藏内容')
                    : t('sysconfws.action.showContent', '显示内容')}
                </button>
              ) : null}
            </div>

            <div className="mt-4 space-y-4">
              {item.inputKind === 'textarea' ? (
                <AppTextarea
                  value={Array.isArray(item.value) ? item.value.join('\n') : String(item.value || '')}
                  onChange={(event) => {
                    const lines = event.target.value
                      .split('\n')
                      .map((line) => line.trim())
                      .filter(Boolean)
                    updateConfigValue(item.key, lines)
                  }}
                  className={`${inputClassName} min-h-[120px] resize-y`}
                  rows={4}
                  placeholder={item.placeholder}
                />
              ) : item.inputKind === 'number' ? (
                <AppInput
                  type="number"
                  min={item.min}
                  max={item.max}
                  step={item.step}
                  value={
                    typeof item.value === 'number'
                      ? item.value
                      : Number.parseInt(String(item.value ?? item.min ?? 0), 10)
                  }
                  onChange={(event) => {
                    const nextValue = Number.parseInt(event.target.value, 10)
                    updateConfigValue(item.key, Number.isNaN(nextValue) ? (item.min ?? 0) : nextValue)
                  }}
                  className={inputClassName}
                />
              ) : (
                <AppInput
                  type={
                    item.inputKind === 'password'
                      ? isSensitiveConfigVisible(item.key)
                        ? 'text'
                        : 'password'
                      : 'text'
                  }
                  value={String(item.value ?? '')}
                  onChange={(event) => updateConfigValue(item.key, event.target.value)}
                  className={`${inputClassName} ${item.sensitive ? 'font-mono tracking-[0.08em]' : ''}`}
                  placeholder={item.placeholder}
                />
              )}

              {item.hint ? (
                <p className="rounded-md bg-muted/50 px-3 py-2 text-xs leading-5 text-muted-foreground">
                  {item.hint}
                </p>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

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
