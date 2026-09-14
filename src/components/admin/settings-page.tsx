'use client'

import * as React from 'react'

import { PageHeader } from '@/components/admin/page-header'
import {
  SettingsSectionNav,
} from '@/components/admin/settings-section-nav'
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

/**
 * 系统设置任务页：概览（摘要 + 分区链接）→ 分区（单一表单区 + StickySaveBar）。
 * 分区内容由容器注入（SystemConfigWorkspace 切片）。
 */
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

  return (
    <>
      {activeSection && activeGroup ? (
        <>
          <PageHeader
            breadcrumbs={[{ label: t('settingsPage.title', '系统设置'), href: '/admin/settings' }]}
            title={activeGroup.title}
            description={activeGroup.description}
          />
          <div className="mb-4">
            <SettingsSectionNav groups={pageModel.groups} activeKey={activeSection} variant="tabs" />
          </div>
          {error ? <ErrorState message={error} retry={onRetry} className="mb-4" /> : null}
          {loading ? (
            <p className="text-sm text-muted-foreground">{t('settingsPage.loading', '正在加载配置...')}</p>
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
        </>
      ) : (
        <>
          <PageHeader
            title={t('settingsPage.title', '系统设置')}
            description={t('settingsPage.description', '白名单、会话、展示与通知的集中管理入口。')}
          />
          {error ? <ErrorState message={error} retry={onRetry} className="mb-4" /> : null}
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {pageModel.summaryCards.map((card) => (
              <div key={card.label} className="rounded-lg border bg-card px-4 py-4 shadow-sm">
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{card.value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{card.description}</p>
              </div>
            ))}
          </div>

          <h2 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t('settingsPage.sectionsTitle', '配置分区')}
          </h2>
          <SettingsSectionNav groups={pageModel.groups} variant="cards" />

          <h2 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t('settingsPage.accountTitle', '账户')}
          </h2>
          <a
            href="/admin/settings/security"
            className="flex items-center justify-between rounded-lg border bg-card p-5 shadow-sm transition hover:border-primary/40"
          >
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {t('settingsPage.securityTitle', '账户安全')}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('settingsPage.securityDescription', '修改管理员登录密码，改后需重新登录。')}
              </p>
            </div>
            <ChevronRight />
          </a>
        </>
      )}
    </>
  )
}

function ChevronRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden>
      <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
