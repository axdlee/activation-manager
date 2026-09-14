'use client'

import * as React from 'react'

import { AdminShell } from '@/components/admin/admin-shell'
import { LicenseGenerationPage } from '@/components/admin/license-generation-page'
import { useOptionalToast } from '@/components/toast-provider'
import { cardTypes } from '@/lib/dashboard-page-types'
import type { LicenseModeValue } from '@/lib/license-status'
import { useDashboardData } from '@/lib/use-dashboard-data'
import { useActivationCodeGeneration } from '@/lib/use-activation-code-generation'

function AdminLicenseGenerationContainer() {
  const { toast } = useOptionalToast()
  const { projects, fetchProjects } = useDashboardData()
  const [selectedProjectKey, setSelectedProjectKey] = React.useState('')
  const [licenseMode, setLicenseMode] = React.useState<LicenseModeValue>('TIME')
  const [actionLoading, setActionLoading] = React.useState(false)

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

  const generation = useActivationCodeGeneration({
    selectedProjectKey,
    licenseMode,
    cardTypes,
    isLoading: actionLoading,
    onShowMessage: showMessage,
    onLoadingChange: setActionLoading,
  })

  React.useEffect(() => {
    void fetchProjects().then((list) => {
      if (list && list.length > 0 && !selectedProjectKey) {
        setSelectedProjectKey(list[0].projectKey)
      }
    })
    // 仅首载时取默认项目
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCardTypeChange = (value: string) => {
    generation.handleCardTypeSelection(value)
  }

  const handleExpiryDaysChange = (value: number) => {
    if (generation.selectedCardType === '自定义') {
      generation.setCustomDays(value)
    } else {
      generation.setExpiryDays(value)
    }
  }

  return (
    <AdminShell activeTab="generate">
      <LicenseGenerationPage
        loading={actionLoading}
        projects={projects}
        cardTypes={cardTypes}
        generatedCodes={generation.generatedCodes}
        onCopyCode={(code) => {
          void navigator.clipboard
            ?.writeText(code)
            .then(() => showMessage('激活码已复制'))
            .catch(() => showMessage('当前环境不支持自动复制，请手动复制', 'error'))
        }}
        form={{
          selectedProjectKey,
          onProjectKeyChange: setSelectedProjectKey,
          licenseMode,
          onLicenseModeChange: setLicenseMode,
          amount: generation.amount,
          onAmountChange: generation.setAmount,
          selectedCardType: generation.selectedCardType,
          onCardTypeChange: handleCardTypeChange,
          expiryDaysValue:
            generation.selectedCardType === '自定义' ? generation.customDays : generation.expiryDays,
          onExpiryDaysChange: handleExpiryDaysChange,
          totalCount: generation.totalCount,
          onTotalCountChange: generation.setTotalCount,
          rebindPolicyValue: generation.generateRebindPolicy,
          onRebindPolicyChange: generation.setGenerateRebindPolicy,
          rebindCooldownMinutesValue: generation.generateRebindCooldownMinutes,
          onRebindCooldownMinutesChange: generation.setGenerateRebindCooldownMinutes,
          rebindMaxCountValue: generation.generateRebindMaxCount,
          onRebindMaxCountChange: generation.setGenerateRebindMaxCount,
          onSubmit: generation.handleGenerateCodes,
        }}
      />
    </AdminShell>
  )
}

export default function AdminLicenseGenerationPage() {
  return <AdminLicenseGenerationContainer />
}
