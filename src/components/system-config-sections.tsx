'use client'

import React from 'react'

import { AppInput } from '@/components/ui/app-input'
import { AppSelect } from '@/components/ui/app-select'
import { AppTextarea } from '@/components/ui/app-textarea'
import {
  type SystemConfigDisplayItem,
  type SystemConfigGroup,
  type SystemConfigGroupKey,
  type SystemConfigValue,
} from '@/lib/system-config-ui'
import { type SystemConfigWorkspaceTab } from '@/lib/dashboard-workspace-tabs'

const systemConfigBadgeClassNameMap = {
  info: 'border-primary/25 bg-primary/10 text-primary',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  danger: 'border-rose-200 bg-rose-50 text-rose-600',
  neutral: 'border-border bg-muted/50 text-foreground/80',
} as const

export const systemConfigGroupThemeMap = {
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

export function resolveInitialTab(
  initialTab: SystemConfigWorkspaceTab,
  tabs: Array<{ key: SystemConfigWorkspaceTab }>,
) {
  return tabs.some((tab) => tab.key === initialTab) ? initialTab : 'overview'
}

// 通知渠道子分组：按 key 前缀把通知组的配置项拆分到各渠道 Tab（Webhook/邮件/短信）
export type NotifyChannelTab = 'webhook' | 'email' | 'sms'

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

export function renderGroupSection({
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
export function NotifyChannelSection({
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

