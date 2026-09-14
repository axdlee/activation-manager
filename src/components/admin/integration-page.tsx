'use client'

import * as React from 'react'

import { PageHeader } from '@/components/admin/page-header'
import { DocsSidebar } from '@/components/admin/docs-sidebar'
import { CodeExampleBlock } from '@/components/admin/code-example-block'
import { ApiDocsWorkspace } from '@/components/api-docs-workspace'
import { apiDocsWorkspaceTabs, type ApiDocsWorkspaceTab } from '@/lib/dashboard-workspace-tabs'
import { useI18n } from '@/lib/i18n/i18n-provider'

export type IntegrationPageProps = {
  activeSection: ApiDocsWorkspaceTab
  onSectionChange: (key: ApiDocsWorkspaceTab) => void
  onFeedback?: (content: string, type?: 'success' | 'error') => void
}

/**
 * API 接入任务页：左侧章节目录（移动端下拉）+ 右侧内容；
 * 「后台联调」同时作为页头 CTA。
 */
export function IntegrationPage({
  activeSection,
  onSectionChange,
  onFeedback,
}: IntegrationPageProps) {
  const { t } = useI18n()
  const sections: Array<Parameters<typeof DocsSidebar>[0]['sections'][number]> =
    apiDocsWorkspaceTabs.map((tab) => ({
      key: tab.key,
      label: tab.label,
      description: tab.description,
    }))

  return (
    <>
      <PageHeader
        title={t('integrationPage.title', 'API 接入')}
        description={t('integrationPage.description', '正式接口、授权模型与多语言示例的接入文档。')}
        actions={
          <button
            type="button"
            onClick={() => onSectionChange('admin')}
            className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition hover:bg-primary/90"
          >
            {t('integrationPage.debugCta', '后台联调')}
          </button>
        }
      />

      <div className="lg:grid lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:items-start lg:gap-6">
        <DocsSidebar
          sections={sections}
          activeKey={activeSection}
          onNavigate={(key) => onSectionChange(key as ApiDocsWorkspaceTab)}
        />
        <div className="mt-6 min-w-0 lg:mt-0">
          <ApiDocsWorkspace
            mode="dashboard"
            initialTab={activeSection}
            showChrome={false}
            onFeedback={onFeedback}
          />
        </div>
      </div>
    </>
  )
}

// 供联调页示例复用：可折叠代码块（复制反馈走统一 toast / 内联已复制态）
export { CodeExampleBlock }
