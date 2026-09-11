'use client'

/**
 * SidebarNav — 管理后台侧边导航（响应式重构）
 *
 * 桌面（lg+）：固定侧栏，可折叠
 * 移动端（<lg）：顶部栏（hamburger + 标题 + 切换器）+ Sheet 抽屉导航
 */

import * as React from 'react'
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
  LogOut,
  ChevronsLeft,
  ChevronsRight,
  Menu,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui-admin/button'
import { Avatar, AvatarFallback } from '@/components/ui-admin/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui-admin/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui-admin/sheet'
import { ThemeSwitcher } from '@/components/theme-switcher'
import { LanguageSwitcher, useI18n } from '@/lib/i18n/i18n-provider'
import type { DashboardTabKey } from '@/lib/dashboard-tab-config'

export type NavItem = {
  key: DashboardTabKey
  label: string
  shortLabel: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

const NAV_ICONS: Record<DashboardTabKey, React.ComponentType<{ className?: string }>> = {
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

export interface SidebarNavProps {
  tabs: NavItem[]
  activeTab: DashboardTabKey
  onTabChange: (key: DashboardTabKey) => void
  brandTitle: string
  brandBadge: string
  username: string
  onLogout: () => void
  onOpenChangePassword?: () => void
}

const GROUP_LABELS: Record<string, { zh: string; en: string }> = {
  overview: { zh: '概览', en: 'Overview' },
  ops: { zh: '运营', en: 'Operations' },
  integration: { zh: '集成与销售', en: 'Integration & Sales' },
  settings: { zh: '设置', en: 'Settings' },
}

export function SidebarNav({ tabs, activeTab, onTabChange, brandTitle, brandBadge, username, onLogout, onOpenChangePassword }: SidebarNavProps) {
  const { t } = useI18n()
  const [collapsed, setCollapsed] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)

  const { locale } = useI18n()
  const groupOrder = ['overview', 'ops', 'integration', 'settings'] as const
  const navList = (collapsedMode: boolean, onNavigate?: () => void) => {
    const visible = tabs.filter((tab) => tab.key !== 'changePassword')
    const sections = groupOrder
      .map((group) => ({
        group,
        items: visible.filter((tab) => (tab as { group?: string }).group === group),
      }))
      .filter((section) => section.items.length > 0)

    return (
      <div className="flex flex-col gap-4">
        {sections.map((section) => (
          <div key={section.group} className="flex flex-col gap-0.5">
            {!collapsedMode && (
              <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {GROUP_LABELS[section.group][locale === 'en-US' ? 'en' : 'zh']}
              </div>
            )}
            {collapsedMode && <div className="mx-3 my-1 border-t" />}
            <ul className="flex flex-col gap-0.5">
              {section.items.map((tab) => {
        const Icon = NAV_ICONS[tab.key] ?? ListTree
        const isActive = tab.key === activeTab
        return (
          <li key={tab.key}>
            <button
              type="button"
              onClick={() => {
                onTabChange(tab.key)
                onNavigate?.()
              }}
              title={collapsedMode ? tab.label : undefined}
              className={cn(
                'group relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                collapsedMode && 'justify-center px-0',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-primary" />
              )}
              <Icon className={cn('h-4 w-4 shrink-0', isActive && 'text-primary')} />
              {!collapsedMode && <span className="truncate">{tab.label}</span>}
            </button>
          </li>
              )})}
            </ul>
          </div>
        ))}
      </div>
    )
  }

  const brandBlock = (collapsedMode: boolean) => (
    <div className={cn('border-b px-4 py-5', collapsedMode && 'px-3')}>
      <div className={cn('flex items-center gap-2', collapsedMode && 'justify-center')}>
        {!collapsedMode && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            {brandBadge}
          </span>
        )}
        {collapsedMode && <span className="h-2 w-2 rounded-full bg-primary" />}
      </div>
      {!collapsedMode && (
        <h1 className="mt-3 truncate text-lg font-semibold tracking-tight text-foreground">{brandTitle}</h1>
      )}
    </div>
  )

  const userBlock = (collapsedMode: boolean, onNavigate?: () => void) => (
    <div className={cn('space-y-2 border-t p-3', collapsedMode && 'px-2')}>
      {!collapsedMode && (
        <div className="flex items-center gap-2 px-1">
          <LanguageSwitcher />
          <ThemeSwitcher />
        </div>
      )}
      <div className={cn('flex items-center gap-2', collapsedMode && 'flex-col')}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                'flex w-full items-center gap-2 rounded-md p-1.5 text-left transition-colors hover:bg-accent',
                collapsedMode && 'justify-center',
              )}
            >
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-primary/15 text-xs text-primary">
                  {(username || 'A').slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {!collapsedMode && (
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-foreground">{username || 'admin'}</span>
                  <span className="block text-[10px] text-muted-foreground">Administrator</span>
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-48">
            <DropdownMenuLabel>{username || 'admin'}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                onNavigate?.()
                onOpenChangePassword?.()
              }}
            >
              <KeySquare />
              {tabs.find((tab) => tab.key === 'changePassword')?.label ?? '修改密码'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                onNavigate?.()
                onLogout()
              }}
            >
              <LogOut />
              {t('dash.nav.logout', '登出')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {!collapsedMode && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start px-2 text-muted-foreground"
            onClick={() => {
              onNavigate?.()
              onLogout()
            }}
          >
            <LogOut />
            {t('dash.nav.logout', '登出')}
          </Button>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* 移动端顶栏（<lg） */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b bg-card px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-64 flex-col p-0">
              <SheetHeader className="border-b px-4 py-4 text-left">
                <SheetTitle className="text-base">{brandTitle}</SheetTitle>
              </SheetHeader>
              <nav className="dashboard-scroll-area flex-1 overflow-y-auto px-2 py-3">{navList(false)}</nav>
              <div className="space-y-2 border-t p-3">
                <div className="flex items-center gap-2 px-1">
                  <LanguageSwitcher />
                  <ThemeSwitcher />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start px-2 text-muted-foreground"
                  onClick={() => {
                    setMobileOpen(false)
                    onLogout()
                  }}
                >
                  <LogOut />
                  {t('dash.nav.logout', '登出')}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          <span className="text-sm font-semibold text-foreground">{brandTitle}</span>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeSwitcher />
        </div>
      </div>

      {/* 桌面侧栏（lg+） */}
      <aside
        className={cn(
          'hidden h-full flex-col border-r bg-card transition-[width] duration-200 lg:flex',
          collapsed ? 'w-[68px]' : 'w-64',
        )}
      >
        {brandBlock(collapsed)}
        <nav className="dashboard-scroll-area flex-1 overflow-y-auto px-2 py-3">{navList(collapsed)}</nav>
        {userBlock(collapsed)}
        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center text-muted-foreground"
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? <ChevronsRight /> : <ChevronsLeft />}
            {!collapsed && t('dash.sidebar.collapse', '收起侧栏')}
          </Button>
        </div>
      </aside>
    </>
  )
}
