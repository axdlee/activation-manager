'use client'

import React, { useEffect, useMemo, useState } from 'react'

import { DashboardEmptyState } from '@/components/dashboard-empty-state'
import { DashboardLoadingState } from '@/components/dashboard-loading-state'
import { WorkspaceTabNav } from '@/components/workspace-tab-nav'
import { AppInput } from '@/components/ui/app-input'
import { AppSelect } from '@/components/ui/app-select'
import { AppTextarea } from '@/components/ui/app-textarea'
import {
  buildSystemConfigWorkspaceTabs,
  type SystemConfigWorkspaceTab,
} from '@/lib/dashboard-workspace-tabs'
import {
  type SystemConfigGroup,
  type SystemConfigPageModel,
  type SystemConfigValue,
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
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  updateConfigValue: (key: string, value: SystemConfigValue) => void
  toggleSensitiveConfigVisibility: (key: string) => void
  isSensitiveConfigVisible: (key: string) => boolean
}

const systemConfigBadgeClassNameMap = {
  info: 'border-brand-500/20 bg-brand-500/10 text-brand-400',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  danger: 'border-rose-200 bg-rose-50 text-rose-600',
  neutral: 'border-surface-200 bg-surface-50 text-ink-300',
} as const

const systemConfigGroupThemeMap = {
  access: {
    badge: 'border border-surface-200 bg-surface-50 text-ink-300',
    dot: 'bg-brand-500',
    title: 'text-ink-50',
    note: 'border-surface-200 bg-surface-50 text-ink-300',
    divider: 'border-surface-200',
    summaryPanel: 'border-surface-200 bg-surface-100',
  },
  rebind: {
    badge: 'border border-surface-200 bg-surface-50 text-ink-300',
    dot: 'bg-emerald-500',
    title: 'text-ink-50',
    note: 'border-surface-200 bg-surface-50 text-ink-300',
    divider: 'border-surface-200',
    summaryPanel: 'border-surface-200 bg-surface-100',
  },
  security: {
    badge: 'border border-surface-200 bg-surface-50 text-ink-300',
    dot: 'bg-violet-500',
    title: 'text-ink-50',
    note: 'border-surface-200 bg-surface-50 text-ink-300',
    divider: 'border-surface-200',
    summaryPanel: 'border-surface-200 bg-surface-100',
  },
  branding: {
    badge: 'border border-surface-200 bg-surface-50 text-ink-300',
    dot: 'bg-amber-500',
    title: 'text-ink-50',
    note: 'border-surface-200 bg-surface-50 text-ink-300',
    divider: 'border-surface-200',
    summaryPanel: 'border-surface-200 bg-surface-100',
  },
  advanced: {
    badge: 'border border-surface-200 bg-surface-50 text-ink-300',
    dot: 'bg-surface-500',
    title: 'text-ink-50',
    note: 'border-surface-200 bg-surface-50 text-ink-300',
    divider: 'border-surface-200',
    summaryPanel: 'border-surface-200 bg-surface-100',
  },
} as const

const systemConfigFocusNoteMap = {
  access: '修改白名单前先核对当前访问 IP，避免把自己锁在系统外。',
  rebind: '这里配置的是系统级默认策略，项目级与单码级可继续覆盖；建议结合冷却时间与次数上限一起审视。',
  security: '这里的修改会立即影响登录态与密码安全成本，建议优先复核。',
  branding: '展示项会直接出现在登录页和后台标题区，建议与实际产品名称保持一致。',
  advanced: '高级配置通常承载扩展项，变更前请先确认其消费方与默认回退逻辑。',
} as const

const overviewChecklistItems = [
  '修改 JWT 密钥后，当前所有管理员会话都需要重新登录。',
  '调整 IP 白名单前，请确认当前访问 IP 已被包含，避免把自己锁在系统外。',
  '系统级换绑策略只提供默认值，最终生效优先级仍然是：系统级配置 < 项目级配置 < 单码级配置。',
  '提升 bcrypt 轮数会增强安全性，但登录与改密耗时也会增加。',
]

const overviewActionButtonClassName =
  'inline-flex items-center justify-center rounded-md border border-surface-200 bg-surface-100 px-4 py-2.5 text-sm font-medium text-ink-300 shadow-sm transition hover:-translate-y-0.5 hover:border-surface-300 hover:bg-surface-50'

function resolveInitialTab(
  initialTab: SystemConfigWorkspaceTab,
  tabs: Array<{ key: SystemConfigWorkspaceTab }>,
) {
  return tabs.some((tab) => tab.key === initialTab) ? initialTab : 'overview'
}

function renderGroupSection({
  group,
  panelClassName,
  inputClassName,
  updateConfigValue,
  toggleSensitiveConfigVisibility,
  isSensitiveConfigVisible,
}: {
  group: SystemConfigGroup
  panelClassName: string
  inputClassName: string
  updateConfigValue: (key: string, value: SystemConfigValue) => void
  toggleSensitiveConfigVisibility: (key: string) => void
  isSensitiveConfigVisible: (key: string) => boolean
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
            当前分区配置
          </div>
          <h3 className={`mt-4 text-xl font-semibold tracking-tight ${groupTheme.title}`}>
            {group.title}
          </h3>
          <p className="mt-2 text-sm leading-7 text-ink-500">{group.description}</p>
          <div className={`mt-4 rounded-md border px-4 py-3 text-sm leading-6 ${groupTheme.note}`}>
            {systemConfigFocusNoteMap[group.key]}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-surface-200 bg-surface-50 px-3 py-1.5 text-xs font-medium text-ink-500">
            {group.items.length} 项配置
          </span>
          <span className="rounded-full border border-surface-200 bg-surface-50 px-3 py-1.5 text-xs font-medium text-ink-500">
            {group.items.filter((item) => item.sensitive).length} 个敏感项
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {group.items.map((item) => (
          <article key={item.key} className="rounded-lg border border-surface-200 bg-surface-100 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-base font-semibold text-ink-50">{item.label}</h4>
                  {item.badges?.map((badge) => (
                    <span
                      key={`${item.key}-${badge.label}`}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${systemConfigBadgeClassNameMap[badge.tone]}`}
                    >
                      {badge.label}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-sm leading-6 text-ink-500">{item.description}</p>
              </div>

              {item.sensitive ? (
                <button
                  type="button"
                  onClick={() => toggleSensitiveConfigVisibility(item.key)}
                  className="inline-flex items-center justify-center rounded-md border border-surface-200 bg-surface-100 px-3 py-2 text-xs font-medium text-ink-300 shadow-sm transition hover:border-surface-300 hover:bg-surface-50"
                >
                  {isSensitiveConfigVisible(item.key) ? '隐藏内容' : '显示内容'}
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
                <div className="rounded-md border border-surface-200 bg-surface-50 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-500">
                    当前白名单预览
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.previewTokens.length > 0 ? (
                      item.previewTokens.map((token) => (
                        <span
                          key={`${item.key}-${token}`}
                          className="rounded-full border border-brand-500/20 bg-brand-500/10 px-3 py-1.5 text-xs font-medium text-brand-400"
                        >
                          {token}
                        </span>
                      ))
                    ) : (
                      <span className="rounded-full border border-dashed border-surface-200 px-3 py-1.5 text-xs text-ink-500">
                        尚未填写 IP 地址
                      </span>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div className={`mt-4 rounded-lg border px-4 py-3 ${groupTheme.note}`}>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">
                操作建议
              </div>
              <div className="text-sm leading-6">{item.hint}</div>
            </div>
          </article>
        ))}
      </div>
    </section>
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
    'rounded-lg border border-surface-200/70 bg-surface-100 shadow-card',
  initialTab = 'overview',
  onSubmit,
  updateConfigValue,
  toggleSensitiveConfigVisibility,
  isSensitiveConfigVisible,
}: SystemConfigWorkspaceProps) {
  const handleScanExpired = async () => {
    setScanningExpired(true)
    setScanMessage('')
    try {
      const response = await fetch('/api/admin/notifications/scan-expired', { method: 'POST' })
      const data = (await response.json()) as { success: boolean; message?: string }
      if (!data.success) {
        setScanMessage(data.message ?? '扫描失败')
        return
      }
      setScanMessage(data.message ?? '扫描完成')
    } catch {
      setScanMessage('扫描失败，请稍后重试')
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
      <section className={`${panelClassName} p-6 sm:p-7`}>
        <div className="max-w-3xl">
          <div className="inline-flex items-center rounded-full border border-surface-200 bg-surface-50 px-3 py-1 text-[11px] font-semibold tracking-[0.22em] text-ink-300">
            配置工作台
          </div>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-ink-50">系统配置中心</h2>
          <p className="mt-2 text-sm leading-7 text-ink-500 sm:text-base">
            按分区集中管理系统配置，修改后统一保存并立即生效。
          </p>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {pageModel.summaryCards.map((card) => (
            <span
              key={card.label}
              className="rounded-full border border-surface-200 bg-surface-50 px-3 py-1.5 text-xs font-medium text-ink-500"
            >
              {card.label}：{card.value}
            </span>
          ))}
        </div>

        <div className="mt-6">
          <WorkspaceTabNav tabs={workspaceTabs} activeTab={activeTab} onChange={setActiveTab} />
        </div>
      </section>

      {loading && pageModel.groups.length === 0 ? (
        <div className={panelClassName}>
          <DashboardLoadingState message="正在加载系统配置..." className="py-10 text-center" />
        </div>
      ) : pageModel.groups.length === 0 ? (
        <DashboardEmptyState className={panelClassName} message="暂无系统配置数据" />
      ) : activeGroup ? (
        <form onSubmit={onSubmit} className="space-y-6">
          {renderGroupSection({
            group: activeGroup,
            panelClassName,
            inputClassName,
            updateConfigValue,
            toggleSensitiveConfigVisibility,
            isSensitiveConfigVisible,
          })}

          <section className={`${panelClassName} p-5`}>
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="inline-flex items-center rounded-full border border-surface-200 bg-surface-50 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-ink-300">
                  保存后立即生效
                </div>
                <h3 className="mt-3 text-lg font-semibold text-ink-50">准备保存本次配置变更？</h3>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-500">
                  保存后配置立即生效，涉及访问控制与认证的变更会马上影响后台行为。
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-surface-200 bg-surface-50 px-3 py-1.5 text-xs font-medium text-ink-500">
                    {systemConfigsCount} 项配置
                  </span>
                  <span className="rounded-full border border-surface-200 bg-surface-50 px-3 py-1.5 text-xs font-medium text-ink-500">
                    {sensitiveCount} 个敏感项
                  </span>
                  <span className="rounded-full border border-surface-200 bg-surface-50 px-3 py-1.5 text-xs font-medium text-ink-500">
                    {whitelistEntryCount} 个白名单地址
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center rounded-md bg-ink-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
              >
                {loading ? '保存中...' : '保存配置'}
              </button>
              <button
                type="button"
                onClick={() => void handleScanExpired()}
                disabled={scanningExpired}
                className="inline-flex w-full items-center justify-center rounded-md border border-surface-200 bg-surface-100 px-5 py-3 text-sm font-medium text-ink-300 transition hover:text-ink-50 disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
              >
                {scanningExpired ? '扫描中...' : '扫描到期通知'}
              </button>
            </div>
            {scanMessage ? (
              <p className="mt-2 text-sm text-ink-500">{scanMessage}</p>
            ) : null}
          </section>
        </form>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className={`${panelClassName} p-6`}>
            <div className="mb-5">
              <div className="inline-flex items-center rounded-full border border-surface-200 bg-surface-50 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-ink-300">
                配置总览
              </div>
              <h3 className="mt-4 text-xl font-semibold text-ink-50">先确认这些关键影响</h3>
              <p className="mt-2 text-sm leading-6 text-ink-500">
                所有配置更改即时生效，建议从影响面最大的项目开始调整。
              </p>
            </div>

            <div className="space-y-3">
              {overviewChecklistItems.map((item, index) => (
                <div
                  key={item}
                  className="rounded-md border border-surface-200 bg-surface-50 px-4 py-4 text-sm leading-7 text-ink-300"
                >
                  <span className="mr-2 font-semibold text-ink-50">0{index + 1}</span>
                  {item}
                </div>
              ))}
            </div>

            <div className="mt-6 border-t border-surface-200 pt-6">
              <div className="mb-5">
                <div className="text-sm font-semibold text-ink-50">分区速览</div>
                <p className="mt-2 text-sm leading-6 text-ink-500">
                  先按影响面选择要进入的分区；进入后只显示该分区字段，页面更短，定位更快。
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
                          <p className="mt-2 text-sm leading-6 text-ink-500">{group.description}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => setActiveTab(group.key)}
                          className={overviewActionButtonClassName}
                        >
                          进入分区
                        </button>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-2">
                        <span className="rounded-full border border-surface-200 bg-surface-50 px-3 py-1.5 text-xs font-medium text-ink-500">
                          {group.items.length} 项配置
                        </span>
                        <span className="rounded-full border border-surface-200 bg-surface-50 px-3 py-1.5 text-xs font-medium text-ink-500">
                          {group.items.filter((item) => item.sensitive).length} 个敏感项
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
              <div className="inline-flex items-center rounded-full border border-surface-200 bg-surface-50 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-ink-300">
                保存方式
              </div>
              <h3 className="mt-4 text-lg font-semibold text-ink-50">按分区编辑，统一保存</h3>
              <p className="mt-2 text-sm leading-6 text-ink-500">
                从总览进入各分区，编辑完成后统一保存生效。
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full border border-surface-200 bg-surface-50 px-3 py-1.5 text-xs font-medium text-ink-500">
                  {systemConfigsCount} 项配置
                </span>
                <span className="rounded-full border border-surface-200 bg-surface-50 px-3 py-1.5 text-xs font-medium text-ink-500">
                  {sensitiveCount} 个敏感项
                </span>
                <span className="rounded-full border border-surface-200 bg-surface-50 px-3 py-1.5 text-xs font-medium text-ink-500">
                  {whitelistEntryCount} 个白名单地址
                </span>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab(pageModel.groups[0]?.key || 'overview')}
                className="mt-5 inline-flex w-full items-center justify-center rounded-md bg-ink-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 lg:w-auto"
              >
                前往首个分区
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
