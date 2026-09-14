'use client'

/**
 * AdminShell — 新任务路由的统一壳层
 *
 * 复用 SidebarNav（桌面侧栏 + 移动抽屉），children 为页面内容。
 * 供 /admin/overview、/admin/projects 等新任务页使用；
 * /admin/dashboard 旧兼容页保留自己的壳层。
 */

import * as React from 'react'
import { SidebarNav, type NavItem } from '@/components/admin/sidebar-nav'
import { dashboardTabs, getDashboardTabMeta } from '@/lib/dashboard-tab-config'
import {
  LayoutDashboard,
  FolderKanban,
  KeyRound,
  ListTree,
  ScrollText,
  BookOpen,
  Store,
  Settings2,
  KeySquare,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n/i18n-provider'
import { resolveLegacyAdminTab } from '@/lib/admin-route-map'
import type { DashboardTabKey } from '@/lib/dashboard-tab-config'

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  stats: LayoutDashboard,
  projects: FolderKanban,
  generate: KeyRound,
  list: ListTree,
  consumptions: ScrollText,
  auditLogs: BookOpen,
  apiDocs: BookOpen,
  shop: Store,
  changePassword: KeySquare,
  systemConfig: Settings2,
}

export type AdminShellProps = {
  activeTab: string
  username?: string
  onLogout?: () => void
  children: React.ReactNode
}

export function AdminShell({ activeTab, username = 'admin', onLogout, children }: AdminShellProps) {
  const { t } = useI18n()

  const navItems: NavItem[] = React.useMemo(
    () =>
      dashboardTabs
        .filter((tab) => tab.key !== 'changePassword')
        .map((tab) => {
          const meta = getDashboardTabMeta(tab.key, t)
          return {
            key: tab.key,
            label: meta.label,
            shortLabel: tab.shortLabel,
            description: meta.description,
            group: tab.group,
            icon: ICONS[tab.key] ?? ListTree,
          }
        }),
    [t],
  )

  const handleLogout = React.useCallback(async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' })
    } catch {
      // 忽略
    }
    window.location.assign('/admin/login')
  }, [])

  return (
    <main className="min-h-screen bg-surface-100 text-ink-50 lg:h-screen lg:overflow-hidden">
      <div className="flex h-full flex-col lg:flex-row">
        <SidebarNav
          tabs={navItems}
          activeTab={activeTab as DashboardTabKey}
          onTabChange={(key: DashboardTabKey) => {
            window.location.assign(resolveLegacyAdminTab(key))
          }}
          brandTitle={t('dash.brand.title', '激活码管理后台')}
          brandBadge={t('dash.brand.badge', '授权运营中台')}
          username={username}
          onLogout={onLogout ?? handleLogout}
        />
        <div className="min-w-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:h-screen lg:px-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </div>
      </div>
    </main>
  )
}

