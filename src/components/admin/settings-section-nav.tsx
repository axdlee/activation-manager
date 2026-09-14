'use client'

import * as React from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

import type { SystemConfigPageModel } from '@/lib/system-config-ui'
import { useI18n } from '@/lib/i18n/i18n-provider'

export type SettingsSectionNavItem = {
  key: string
  title: string
  description: string
  badge: string
  itemCount: number
}

export type SettingsSectionNavProps = {
  groups: SystemConfigPageModel['groups']
  /** 当前激活分区（URL ?section= 驱动）；undefined 时渲染概览卡片形态 */
  activeKey?: string
  variant?: 'cards' | 'tabs'
}

/**
 * 设置分区导航：
 * - cards：概览页的分区链接卡（含描述与影响提示）
 * - tabs：分区内的紧凑横向导航
 */
export function SettingsSectionNav({ groups, activeKey, variant = 'tabs' }: SettingsSectionNavProps) {
  const { t } = useI18n()

  if (variant === 'cards') {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {groups.map((group) => (
          <Link
            key={group.key}
            href={`/admin/settings?section=${group.key}`}
            className="group rounded-lg border bg-card p-5 shadow-sm transition hover:border-primary/40 hover:shadow"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-foreground group-hover:text-primary">{group.title}</h3>
              <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
                {group.badge}
              </span>
            </div>
            <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{group.description}</p>
            <p className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
              {t('settingsNav.configure', '前往配置')}
              <ChevronRight className="h-3 w-3" aria-hidden />
            </p>
          </Link>
        ))}
      </div>
    )
  }

  return (
    <nav aria-label={t('settingsNav.label', '设置分区')} className="flex flex-wrap items-center gap-2">
      {groups.map((group) => (
        <Link
          key={group.key}
          href={`/admin/settings?section=${group.key}`}
          aria-current={activeKey === group.key ? 'page' : undefined}
          className={`inline-flex h-10 items-center rounded-md px-3 text-sm font-medium transition ${
            activeKey === group.key
              ? 'bg-primary text-primary-foreground shadow'
              : 'border border-input bg-background text-foreground/80 hover:bg-accent'
          }`}
        >
          {group.title}
        </Link>
      ))}
      <Link
        href="/admin/settings/security"
        className="inline-flex h-10 items-center rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground/80 transition hover:bg-accent"
      >
        {t('settingsNav.security', '账户安全')}
      </Link>
    </nav>
  )
}
