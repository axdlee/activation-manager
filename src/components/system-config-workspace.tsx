'use client'

import React, { useEffect, useMemo, useState } from 'react'

import { DashboardActionPanel } from '@/components/dashboard-action-panel'
import { DashboardEmptyState } from '@/components/dashboard-empty-state'
import { DashboardLoadingState } from '@/components/dashboard-loading-state'
import { DashboardNumberedList } from '@/components/dashboard-numbered-list'
import { DashboardStatTile } from '@/components/dashboard-stat-tile'
import { DashboardSummaryCard } from '@/components/dashboard-summary-card'
import { WorkspaceHeroPanel } from '@/components/workspace-hero-panel'
import { WorkspaceTabNav } from '@/components/workspace-tab-nav'
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
    summaryPanel: 'border-sky-200/80 bg-sky-50/85',
  },
  security: {
    panel: 'border-violet-200/80 bg-[linear-gradient(180deg,rgba(245,243,255,0.92),rgba(255,255,255,0.96))]',
    badge: 'bg-violet-100 text-violet-700',
    dot: 'bg-violet-500',
    title: 'text-violet-900',
    note: 'border-violet-200 bg-violet-50 text-violet-700',
    rail: 'from-violet-500 via-fuchsia-400 to-violet-200',
    divider: 'border-violet-100/80',
    summaryPanel: 'border-violet-200/80 bg-violet-50/85',
  },
  branding: {
    panel: 'border-amber-200/80 bg-[linear-gradient(180deg,rgba(255,251,235,0.92),rgba(255,255,255,0.96))]',
    badge: 'bg-amber-100 text-amber-700',
    dot: 'bg-amber-500',
    title: 'text-amber-900',
    note: 'border-amber-200 bg-amber-50 text-amber-700',
    rail: 'from-amber-400 via-yellow-300 to-amber-100',
    divider: 'border-amber-100/80',
    summaryPanel: 'border-amber-200/80 bg-amber-50/85',
  },
  advanced: {
    panel: 'border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.92),rgba(255,255,255,0.96))]',
    badge: 'bg-slate-100 text-slate-700',
    dot: 'bg-slate-500',
    title: 'text-slate-900',
    note: 'border-slate-200 bg-slate-50 text-slate-600',
    rail: 'from-slate-500 via-slate-300 to-slate-100',
    divider: 'border-slate-200/80',
    summaryPanel: 'border-slate-200/80 bg-slate-50/85',
  },
} as const

const systemConfigFocusNoteMap = {
  access: '修改白名单前先核对当前访问 IP，避免把自己锁在系统外。',
  security: '这里的修改会立即影响登录态与密码安全成本，建议优先复核。',
  branding: '展示项会直接出现在登录页和后台标题区，建议与实际产品名称保持一致。',
  advanced: '高级配置通常承载扩展项，变更前请先确认其消费方与默认回退逻辑。',
} as const

const overviewChecklistItems = [
  '修改 JWT 密钥后，当前所有管理员会话都需要重新登录。',
  '调整 IP 白名单前，请确认当前访问 IP 已被包含，避免把自己锁在系统外。',
  '提升 bcrypt 轮数会增强安全性，但登录与改密耗时也会增加。',
]

const overviewActionButtonClassName =
  'inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50'

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
    <section className={`${panelClassName} ${groupTheme.panel} relative overflow-hidden`}>
      <div className={`absolute inset-y-6 left-0 w-1 rounded-full bg-gradient-to-b ${groupTheme.rail}`} />
      <div className="grid gap-0 xl:grid-cols-[280px_minmax(0,1fr)]">
        <div className={`border-b px-6 py-6 xl:border-b-0 xl:border-r ${groupTheme.divider}`}>
          <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold tracking-[0.18em] ${groupTheme.badge}`}>
            <span className={`h-2 w-2 rounded-full ${groupTheme.dot}`} />
            {group.badge}
          </div>
          <h3 className={`mt-4 text-xl font-semibold tracking-tight ${groupTheme.title}`}>{group.title}</h3>
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
                        <h4 className="text-base font-semibold text-slate-900">{item.label}</h4>
                        {item.badges?.map((badge) => (
                          <span
                            key={`${item.key}-${badge.label}`}
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${systemConfigBadgeClassNameMap[badge.tone]}`}
                          >
                            {badge.label}
                          </span>
                        ))}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
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
                      <input
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
                          updateConfigValue(
                            item.key,
                            Number.isNaN(nextValue) ? (item.min ?? 0) : nextValue,
                          )
                        }}
                        className={inputClassName}
                      />
                    ) : item.inputKind === 'select' ? (
                      <select
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
                      </select>
                    ) : (
                      <input
                        type={
                          item.inputKind === 'password'
                            ? (isSensitiveConfigVisible(item.key) ? 'text' : 'password')
                            : 'text'
                        }
                        value={String(item.value ?? '')}
                        onChange={(event) => updateConfigValue(item.key, event.target.value)}
                        className={`${inputClassName} ${item.sensitive ? 'font-mono tracking-[0.08em]' : ''}`}
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
}

export function SystemConfigWorkspace({
  pageModel,
  systemConfigsCount,
  sensitiveCount,
  whitelistEntryCount,
  loading,
  inputClassName,
  panelClassName =
    'rounded-[28px] border border-slate-200/70 bg-white/90 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.28)] backdrop-blur',
  initialTab = 'overview',
  onSubmit,
  updateConfigValue,
  toggleSensitiveConfigVisibility,
  isSensitiveConfigVisible,
}: SystemConfigWorkspaceProps) {
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
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className={`${panelClassName} relative overflow-hidden`}>
          <WorkspaceHeroPanel
            badge="配置工作台"
            title="系统配置中心"
            description="把访问控制、登录安全和系统展示统一收进更短、更清晰的分区工作区，避免整页过长。"
            gradientClassName="bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.12),transparent_30%)]"
            metrics={
              <div className="rounded-[22px] border border-white/80 bg-white/80 px-4 py-4 text-sm leading-6 text-slate-600 shadow-[0_18px_56px_-42px_rgba(15,23,42,0.28)]">
                已归纳为 <span className="font-semibold text-slate-900">{pageModel.groups.length}</span> 个配置分区，进入对应
                tab 可集中编辑并统一保存。
              </div>
            }
            tabs={
              <>
                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {pageModel.summaryCards.map((card) => {
                    const summaryCardTheme =
                      systemConfigSummaryCardThemeMap[
                        card.label as keyof typeof systemConfigSummaryCardThemeMap
                      ] || systemConfigSummaryCardThemeMap.配置项

                    return (
                      <DashboardSummaryCard
                        key={card.label}
                        label={card.label}
                        value={card.value}
                        description={card.description}
                        className="group transition hover:-translate-y-0.5"
                        panelClassName={summaryCardTheme.panel}
                        accentClassName={summaryCardTheme.accent}
                        valueClassName={`mt-3 text-3xl font-semibold tracking-tight ${summaryCardTheme.value}`}
                      />
                    )
                  })}
                </div>

                <WorkspaceTabNav
                  tabs={workspaceTabs}
                  activeTab={activeTab}
                  onChange={setActiveTab}
                />
              </>
            }
          />
        </div>

        {activeGroup ? (
          <div
            className={`${panelClassName} ${systemConfigGroupThemeMap[activeGroup.key].panel} relative overflow-hidden p-6`}
          >
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${systemConfigGroupThemeMap[activeGroup.key].rail}`} />
            <div className="relative">
              <div
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold tracking-[0.18em] ${systemConfigGroupThemeMap[activeGroup.key].badge}`}
              >
                <span className={`h-2 w-2 rounded-full ${systemConfigGroupThemeMap[activeGroup.key].dot}`} />
                当前聚焦分区
              </div>
              <h3 className={`mt-4 text-lg font-semibold ${systemConfigGroupThemeMap[activeGroup.key].title}`}>
                {activeGroup.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">{activeGroup.description}</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <DashboardStatTile
                  label="配置项"
                  value={activeGroup.items.length}
                  description="当前分区可编辑字段"
                />
                <DashboardStatTile
                  label="敏感项"
                  value={activeGroup.items.filter((item) => item.sensitive).length}
                  description="建议双人复核后再保存"
                />
              </div>
              <div
                className={`mt-5 rounded-[22px] border px-4 py-4 text-sm leading-7 ${systemConfigGroupThemeMap[activeGroup.key].note}`}
              >
                {systemConfigFocusNoteMap[activeGroup.key]}
              </div>
            </div>
          </div>
        ) : (
          <div className={`${panelClassName} relative overflow-hidden border-violet-100 bg-[linear-gradient(180deg,rgba(250,245,255,0.96),rgba(255,255,255,0.94))] p-6`}>
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 via-fuchsia-400 to-sky-400" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.12),transparent_30%)]" />
            <div className="relative">
              <div className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-violet-700">
                变更前提示
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">先确认这些关键影响</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                设置页已改为分区工作区，但所有更改依旧属于即时生效型操作，建议先从影响面最大的项开始检查。
              </p>

              <DashboardNumberedList
                className="mt-5 space-y-3"
                itemClassName="flex items-start gap-3 rounded-[22px] border border-white/80 bg-white/75 px-4 py-4 text-sm leading-7 text-slate-600 shadow-sm backdrop-blur"
                items={overviewChecklistItems}
              />

              <div className="mt-5 grid grid-cols-2 gap-3">
                <DashboardStatTile
                  label="敏感项"
                  value={sensitiveCount}
                  description="涉及会话或凭证配置"
                />
                <DashboardStatTile
                  label="白名单地址"
                  value={whitelistEntryCount}
                  description="当前允许访问后台的来源"
                />
              </div>
            </div>
          </div>
        )}
      </div>

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

          <DashboardActionPanel
            badge="保存后立即生效"
            title="准备保存本次配置变更？"
            description="保存后会立即写入系统配置表；涉及认证与白名单的变更会立刻影响后台访问行为。"
            className="relative overflow-hidden rounded-[28px] border border-slate-900/10 bg-slate-950/95 p-5 text-white shadow-[0_32px_90px_-48px_rgba(15,23,42,0.7)] backdrop-blur"
            innerClassName="relative flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"
            titleClassName="mt-3 text-lg font-semibold text-white"
            descriptionClassName="mt-1 max-w-2xl text-sm leading-6 text-slate-300"
            background={
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.18),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.16),transparent_34%)]" />
            }
            action={
              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-slate-950/30 transition hover:-translate-y-0.5 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
              >
                {loading ? '保存中...' : '保存配置'}
              </button>
            }
          >
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-200">
                {systemConfigsCount} 项配置
              </span>
              <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-200">
                {sensitiveCount} 个敏感项
              </span>
              <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-200">
                {whitelistEntryCount} 个白名单地址
              </span>
            </div>
          </DashboardActionPanel>
        </form>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <div className={`${panelClassName} p-6`}>
            <div className="mb-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-slate-600">
                配置导航
              </div>
              <h3 className="mt-4 text-xl font-semibold text-slate-900">分区速览</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                先按影响面选择要进入的分区；进入后只显示该分区字段，页面更短，定位更快。
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {pageModel.groups.map((group) => {
                const groupTheme = systemConfigGroupThemeMap[group.key]

                return (
                  <article
                    key={group.key}
                    className={`rounded-[26px] border p-5 shadow-[0_18px_56px_-42px_rgba(15,23,42,0.22)] ${groupTheme.summaryPanel}`}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold tracking-[0.18em] ${groupTheme.badge}`}>
                          <span className={`h-2 w-2 rounded-full ${groupTheme.dot}`} />
                          {group.badge}
                        </div>
                        <h4 className={`mt-4 text-lg font-semibold ${groupTheme.title}`}>{group.title}</h4>
                        <p className="mt-2 text-sm leading-6 text-slate-500">{group.description}</p>
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
                      <span className="rounded-full border border-white/80 bg-white/85 px-3 py-1.5 text-xs font-medium text-slate-500 shadow-sm">
                        {group.items.length} 项配置
                      </span>
                      <span className="rounded-full border border-white/80 bg-white/85 px-3 py-1.5 text-xs font-medium text-slate-500 shadow-sm">
                        {group.items.filter((item) => item.sensitive).length} 个敏感项
                      </span>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>

          <DashboardActionPanel
            badge="保存方式"
            title="按分区编辑，统一保存"
            description="当前总览只负责导航；进入任一分区后即可集中编辑该组字段，并使用底部保存动作一次性提交全部配置。"
            className="rounded-[28px] border border-slate-900/10 bg-slate-950/95 p-5 text-white shadow-[0_32px_90px_-48px_rgba(15,23,42,0.7)] backdrop-blur"
            descriptionClassName="mt-1 text-sm leading-6 text-slate-300"
            action={
              <button
                type="button"
                onClick={() => setActiveTab(pageModel.groups[0]?.key || 'overview')}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-slate-950/30 transition hover:-translate-y-0.5 hover:bg-slate-100 lg:w-auto"
              >
                前往首个分区
              </button>
            }
          >
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-200">
                {systemConfigsCount} 项配置
              </span>
              <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-200">
                {sensitiveCount} 个敏感项
              </span>
              <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-200">
                {whitelistEntryCount} 个白名单地址
              </span>
            </div>
          </DashboardActionPanel>
        </div>
      )}
    </div>
  )
}
