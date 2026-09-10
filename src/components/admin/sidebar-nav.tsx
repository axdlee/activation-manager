'use client'

/**
 * SidebarNav — 管理后台侧边导航（shadcn 风格重构）
 *
 * 职责：
 *  - 工作区切换（10 个 tab → nav items，带 lucide 图标）
 *  - 语言/主题切换器入口
 *  - 用户区（头像 + 登出）
 *
 * 设计：固定左栏（lg+）/ 移动端顶部抽屉，桌面 hover 高亮 + active 指示条。
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
import { ThemeSwitcher } from '@/components/theme-switcher'
import {
  LanguageSwitcher,
  useI18n,
} from '@/lib/i18n/i18n-provider'
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
}

export function SidebarNav({ tabs, activeTab, onTabChange, brandTitle, brandBadge, username, onLogout }: SidebarNavProps) {
  const { t } = useI18n()
  const [collapsed, setCollapsed] = React.useState(false)

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r bg-card transition-[width] duration-200',
        collapsed ? 'w-[68px]' : 'w-64',
      )}
    >
      {/* 品牌区 */}
      <div className={cn('border-b px-4 py-5', collapsed && 'px-3')}>
        <div className={cn('flex items-center gap-2', collapsed && 'justify-center')}>
          {!collapsed && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              {brandBadge}
            </span>
          )}
          {collapsed && <span className="h-2 w-2 rounded-full bg-primary" />}
        </div>
        {!collapsed && (
          <h1 className="mt-3 truncate text-lg font-semibold tracking-tight text-foreground">{brandTitle}</h1>
        )}
      </div>

      {/* 导航 */}
      <nav className="dashboard-scroll-area flex-1 overflow-y-auto px-2 py-3">
        <ul className="flex flex-col gap-0.5">
          {tabs.map((tab) => {
            const Icon = NAV_ICONS[tab.key] ?? ListTree
            const isActive = tab.key === activeTab
            return (
              <li key={tab.key}>
                <button
                  type="button"
                  onClick={() => onTabChange(tab.key)}
                  title={collapsed ? tab.label : undefined}
                  className={cn(
                    'group relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    collapsed && 'justify-center px-0',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-primary" />
                  )}
                  <Icon className={cn('h-4 w-4 shrink-0', isActive && 'text-primary')} />
                  {!collapsed && <span className="truncate">{tab.label}</span>}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* 用户区 */}
      <div className={cn('space-y-2 border-t p-3', collapsed && 'px-2')}>
        {!collapsed && (
          <div className="flex items-center gap-2 px-1">
            <LanguageSwitcher />
            <ThemeSwitcher />
          </div>
        )}
        <div className={cn('flex items-center gap-2', collapsed && 'flex-col')}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  'flex w-full items-center gap-2 rounded-md p-1.5 text-left transition-colors hover:bg-accent',
                  collapsed && 'justify-center',
                )}
              >
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-primary/15 text-xs text-primary">
                    {(username || 'A').slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {!collapsed && (
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
              <DropdownMenuItem onClick={onLogout}>
                <LogOut />
                {t('dash.nav.logout', '登出')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {!collapsed && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start px-2 text-muted-foreground"
              onClick={onLogout}
            >
              <LogOut />
              {t('dash.nav.logout', '登出')}
            </Button>
          )}
        </div>
        {/* 折叠按钮 */}
        <Button
          variant="ghost"
          size="sm"
          className={cn('w-full justify-center text-muted-foreground', collapsed && 'px-0')}
          onClick={() => setCollapsed((v) => !v)}
        >
          {collapsed ? <ChevronsRight /> : <ChevronsLeft />}
          {!collapsed && t('dash.sidebar.collapse', '收起侧栏')}
        </Button>
      </div>
    </aside>
  )
}
