'use client'

import * as React from 'react'
import { ChevronDown } from 'lucide-react'

import { useI18n } from '@/lib/i18n/i18n-provider'

export type DocsSidebarSection = {
  key: string
  label: string
  description: string
}

export type DocsSidebarProps = {
  sections: DocsSidebarSection[]
  activeKey: string
  onNavigate: (key: string) => void
}

/**
 * API 文档章节目录：
 * - 桌面端左侧固定目录（含 `mt-6 grid` 容器，按钮 label 与分区一致）
 * - 移动端折叠为下拉
 */
export function DocsSidebar({ sections, activeKey, onNavigate }: DocsSidebarProps) {
  const { t } = useI18n()
  const activeSection = sections.find((section) => section.key === activeKey)

  const renderButtons = () =>
    sections.map((section) => {
      const isActive = section.key === activeKey
      return (
        <button
          key={section.key}
          type="button"
          onClick={() => onNavigate(section.key)}
          aria-current={isActive ? 'page' : undefined}
          className={`rounded-lg border p-4 text-left transition ${
            isActive
              ? 'border-primary/25 bg-primary/10 shadow-card'
              : 'border-border bg-card hover:-translate-y-0.5 hover:border-primary/25'
          }`}
        >
          <div
            className={`text-sm font-semibold ${isActive ? 'text-primary' : 'text-foreground'}`}
          >
            {section.label}
          </div>
          <div
            className={`mt-1 text-xs leading-6 ${
              isActive ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            {section.description}
          </div>
        </button>
      )
    })

  return (
    <>
      {/* 桌面端：固定目录（保持 `mt-6 grid` 容器契约） */}
      <nav
        aria-label={t('docsSidebar.label', '文档章节')}
        className="hidden lg:block"
      >
        <div className="sticky top-6 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('docsSidebar.title', '文档章节')}
          </p>
          <div className="mt-6 grid grid-cols-1 gap-2">{renderButtons()}</div>
        </div>
      </nav>

      {/* 移动端：折叠下拉 */}
      <details className="rounded-lg border bg-card shadow-sm lg:hidden">
        <summary className="flex h-11 cursor-pointer items-center gap-1.5 px-4 text-sm font-medium text-foreground select-none">
          <ChevronDown
            className="h-4 w-4 text-muted-foreground transition-transform [[open]>&]:rotate-180"
            aria-hidden
          />
          {activeSection?.label ?? t('docsSidebar.title', '文档章节')}
        </summary>
        <div className="mt-6 grid grid-cols-1 gap-2 border-t px-4 py-3">{renderButtons()}</div>
      </details>
    </>
  )
}
