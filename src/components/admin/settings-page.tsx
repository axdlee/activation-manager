'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  Bell,
  ChevronRight as ChevronRightIcon,
  KeyRound,
  Palette,
  RefreshCw,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
} from 'lucide-react'

import { PageHeader } from '@/components/admin/page-header'
import { StickySaveBar } from '@/components/admin/sticky-save-bar'
import { ErrorState } from '@/components/admin/error-state'
import type { SystemConfigPageModel } from '@/lib/system-config-ui'
import { useI18n } from '@/lib/i18n/i18n-provider'

export type SettingsPageProps = {
  pageModel: SystemConfigPageModel
  /** URL ?section= 驱动的当前分区；空 = 概览 */
  activeSection?: string
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  /** 未保存配置项数量（>0 时显示 StickySaveBar） */
  dirtyCount: number
  saving?: boolean
  onSave?: () => void
  onReset?: () => void
  children?: React.ReactNode
}

/** 分区 → 图标映射（与分区语义一一对应，未知分区兜底 Settings2） */
const SECTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  access: ShieldCheck,
  rebind: RefreshCw,
  security: KeyRound,
  branding: Palette,
  notification: Bell,
  advanced: SlidersHorizontal,
}

function sectionIcon(key: string) {
  return SECTION_ICONS[key] ?? Settings2
}

/**
 * 系统设置任务页（现代配置页布局）：
 * - 概览：统计摘要卡 + 分区入口卡（图标/名称/描述/条目数）
 * - 分区：左侧 sticky 导航 + 右侧单一表单区 + StickySaveBar
 * - 账户安全固定于导航底部，与配置分区明确区隔
 */
// a11y-ok: exclusive-pageheaders —— 概览/分区两个 PageHeader 互斥渲染，运行时每页仅一个
export function SettingsPage({
  pageModel,
  activeSection,
  loading = false,
  error = null,
  onRetry,
  dirtyCount,
  saving = false,
  onSave,
  onReset,
  children,
}: SettingsPageProps) {
  const { t } = useI18n()
  const activeGroup = pageModel.groups.find((group) => group.key === activeSection)

  const navList = (
    <nav aria-label={t('settingsNav.label', '设置分区')} className="space-y-1">
      {pageModel.groups.map((group) => {
        const Icon = sectionIcon(group.key)
        const isActive = activeSection === group.key
        return (
          <Link
            key={group.key}
            href={`/admin/settings?section=${group.key}`}
            aria-current={isActive ? 'page' : undefined}
            className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 transition ${
              isActive
                ? 'border-primary/30 bg-primary/10'
                : 'border-transparent hover:border-border hover:bg-accent'
            }`}
          >
            <Icon
              className={`mt-0.5 h-4 w-4 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
            />
            <span className="min-w-0">
              <span
                className={`block truncate text-sm font-medium ${isActive ? 'text-primary' : 'text-foreground'}`}
              >
                {group.title}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {group.items.length} {t('settingsNav.items', '项配置')}
              </span>
            </span>
          </Link>
        )
      })}

      <div role="separator" className="!my-3 border-t" />

      <Link
        href="/admin/settings/security"
        className="flex items-start gap-3 rounded-lg border border-transparent px-3 py-2.5 transition hover:border-border hover:bg-accent"
      >
        <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-foreground">
            {t('settingsNav.securityTitle', '账户安全')}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {t('settingsNav.securityDesc', '修改管理员密码')}
          </span>
        </span>
      </Link>
    </nav>
  )

  if (activeSection && activeGroup) {
    const ActiveIcon = sectionIcon(activeGroup.key)
    return (
      <>
        <PageHeader
          breadcrumbs={[{ label: t('settingsPage.title', '系统设置'), href: '/admin/settings' }]}
          title={activeGroup.title}
          description={activeGroup.description}
          actions={
            <ActiveIcon className="h-5 w-5 text-muted-foreground" aria-hidden />
          }
        />

        <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start lg:gap-8">
          <aside className="lg:sticky lg:top-6">{navList}</aside>

          <div className="mt-6 min-w-0 lg:mt-0">
            {error ? <ErrorState message={error} retry={onRetry} className="mb-4" /> : null}
            {loading ? (
              <p className="text-sm text-muted-foreground">
                {t('settingsPage.loading', '正在加载配置...')}
              </p>
            ) : (
              children
            )}

            <StickySaveBar
              dirtyCount={dirtyCount}
              saving={saving}
              onSave={onSave ?? (() => {})}
              onReset={onReset ?? (() => {})}
              dirtyLabel={
                dirtyCount > 0
                  ? t('settingsPage.unsaved', '{count} 项配置未保存').replace(
                      '{count}',
                      String(dirtyCount),
                    )
                  : undefined
              }
            />
          </div>
        </div>
      </>
    )
  }

  // ── 概览 ──
  return (
    <>
      <PageHeader
        title={t('settingsPage.title', '系统设置')}
        description={t('settingsPage.description', '集中管理白名单、会话、展示、通知与高级配置。')}
      />

      {error ? <ErrorState message={error} retry={onRetry} className="mb-4" /> : null}

      {/* 统计摘要卡 */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {pageModel.summaryCards.map((card, index) => {
          const Icon = sectionIcon(pageModel.groups[index]?.key ?? 'advanced')
          return (
            <div
              key={card.label}
              className="rounded-lg border bg-card p-4 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <Icon className="h-4 w-4 text-muted-foreground/70" aria-hidden />
              </div>
              <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{card.value}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{card.description}</p>
            </div>
          )
        })}
      </div>

      {/* 分区入口 */}
      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {t('settingsPage.sectionsTitle', '配置分区')}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {pageModel.groups.map((group) => {
          const Icon = sectionIcon(group.key)
          return (
            <Link
              key={group.key}
              href={`/admin/settings?section=${group.key}`}
              className="group rounded-lg border bg-card p-5 shadow-sm transition hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex items-start gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-foreground group-hover:text-primary">
                      {group.title}
                    </span>
                    <span className="shrink-0 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
                      {group.items.length} {t('settingsNav.items', '项')}
                    </span>
                  </span>
                  <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">
                    {group.description}
                  </span>
                </span>
                <ChevronRightIcon className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>
            </Link>
          )
        })}
      </div>

      {/* 账户安全 */}
      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {t('settingsPage.accountTitle', '账户')}
      </h2>
      <Link
        href="/admin/settings/security"
        className="group flex items-center justify-between rounded-lg border bg-card p-5 shadow-sm transition hover:border-primary/40"
      >
        <span className="flex items-start gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <UserRound className="h-5 w-5" aria-hidden />
          </span>
          <span>
            <span className="block text-sm font-semibold text-foreground group-hover:text-primary">
              {t('settingsNav.securityTitle', '账户安全')}
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">
              {t('settingsPage.securityDescription', '修改管理员登录密码，改后需重新登录。')}
            </span>
          </span>
        </span>
        <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
      </Link>
    </>
  )
}

