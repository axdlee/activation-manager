'use client'

import * as React from 'react'
import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { AdminShell } from '@/components/admin/admin-shell'
import { IntegrationPage } from '@/components/admin/integration-page'
import { useOptionalToast } from '@/components/toast-provider'
import { apiDocsWorkspaceTabs, type ApiDocsWorkspaceTab } from '@/lib/dashboard-workspace-tabs'

const SECTION_KEYS = apiDocsWorkspaceTabs.map((tab) => tab.key)

function AdminIntegrationContainer() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useOptionalToast()

  const sectionParam = searchParams.get('section') as ApiDocsWorkspaceTab | null
  const activeSection: ApiDocsWorkspaceTab =
    sectionParam && SECTION_KEYS.includes(sectionParam) ? sectionParam : 'overview'

  const showMessage = React.useCallback(
    (message: string, type: 'success' | 'error' = 'success') => {
      if (!toast) return
      if (type === 'error') {
        toast.error(message)
      } else {
        toast.success(message)
      }
    },
    [toast],
  )

  return (
    <IntegrationPage
      activeSection={activeSection}
      onSectionChange={(key) => {
        router.replace(`/admin/integration?section=${key}`, { scroll: false })
      }}
      onFeedback={showMessage}
    />
  )
}

export default function AdminIntegrationPage() {
  return (
    <AdminShell activeTab="apiDocs">
      <Suspense fallback={null}>
        <AdminIntegrationContainer />
      </Suspense>
    </AdminShell>
  )
}
