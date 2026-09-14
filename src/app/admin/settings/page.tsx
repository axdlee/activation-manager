'use client'

import * as React from 'react'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

import { AdminShell } from '@/components/admin/admin-shell'
import { SettingsPage } from '@/components/admin/settings-page'
import { SystemConfigWorkspace } from '@/components/system-config-workspace'
import { useOptionalToast } from '@/components/toast-provider'
import { useDashboardData } from '@/lib/use-dashboard-data'
import { useSystemConfigWorkspace } from '@/lib/use-system-config-workspace'

function AdminSettingsContainer() {
  const searchParams = useSearchParams()
  const { toast } = useOptionalToast()
  const { systemConfigs, setSystemConfigs, fetchSystemConfigs } = useDashboardData()
  const [configLoading, setConfigLoading] = React.useState(false)
  const [baseline, setBaseline] = React.useState<Record<string, string> | null>(null)

  const sectionParam = searchParams.get('section')

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

  const workspace = useSystemConfigWorkspace({
    systemConfigs,
    setSystemConfigs,
    onShowMessage: showMessage,
    onLoadingChange: setConfigLoading,
    onFetchSystemConfigs: fetchSystemConfigs,
  })

  React.useEffect(() => {
    void fetchSystemConfigs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 加载完成后记录基线（用于 dirty 计数）；保存后重新拉取也会经过这里
  React.useEffect(() => {
    if (configLoading) return
    if (systemConfigs.length > 0) {
      setBaseline(
        Object.fromEntries(systemConfigs.map((config) => [config.key, JSON.stringify(config.value)])),
      )
    }
  }, [configLoading, systemConfigs])

  const dirtyCount = React.useMemo(() => {
    if (!baseline) return 0
    return systemConfigs.filter((config) => baseline[config.key] !== JSON.stringify(config.value)).length
  }, [baseline, systemConfigs])

  const pageModel = workspace.systemConfigPageModel
  const activeSection =
    pageModel.groups.find((group) => group.key === sectionParam)?.key ?? null
  const slicedModel = activeSection
    ? { ...pageModel, groups: pageModel.groups.filter((group) => group.key === activeSection) }
    : pageModel

  const handleSave = React.useCallback(() => {
    const form = document.getElementById('system-config-form') as HTMLFormElement | null
    form?.requestSubmit()
  }, [])

  const handleReset = React.useCallback(() => {
    void fetchSystemConfigs()
  }, [fetchSystemConfigs])

  return (
    <SettingsPage
      pageModel={pageModel}
      activeSection={activeSection ?? undefined}
      loading={configLoading}
      dirtyCount={dirtyCount}
      saving={configLoading}
      onSave={handleSave}
      onReset={handleReset}
    >
      {activeSection ? (
        <SystemConfigWorkspace
          pageModel={slicedModel}
          systemConfigsCount={systemConfigs.length}
          sensitiveCount={workspace.systemConfigSensitiveCount}
          whitelistEntryCount={workspace.systemConfigWhitelistEntryCount}
          loading={configLoading}
          inputClassName=""
          initialTab={activeSection}
          onSubmit={workspace.handleUpdateSystemConfig}
          updateConfigValue={workspace.updateConfigValue}
          toggleSensitiveConfigVisibility={workspace.toggleSensitiveConfigVisibility}
          isSensitiveConfigVisible={workspace.isSensitiveConfigVisible}
        />
      ) : null}
    </SettingsPage>
  )
}

export default function AdminSettingsPage() {
  return (
    <AdminShell activeTab="systemConfig">
      <Suspense fallback={null}>
        <AdminSettingsContainer />
      </Suspense>
    </AdminShell>
  )
}
