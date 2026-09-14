'use client'

import * as React from 'react'
import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { AdminShell } from '@/components/admin/admin-shell'
import { ConfirmDialog } from '@/components/admin/confirm-dialog'
import { LicensesPage } from '@/components/admin/licenses-page'
import { LicenseDetailDrawer } from '@/components/admin/license-detail-drawer'
import type { LicensePolicyDraft } from '@/components/admin/license-detail-drawer'
import { useOptionalToast } from '@/components/toast-provider'
import {
  buildAdminLicensesFilterQuery,
  parseAdminLicensesFilterQuery,
  type AdminLicensesFilterState,
} from '@/lib/admin-licenses-query'
import { exportCodesCsv } from '@/lib/license-codes-export'
import type { ActivationCode } from '@/lib/dashboard-page-types'
import { useDashboardData } from '@/lib/use-dashboard-data'
import { useActivationCodeManagement } from '@/lib/use-activation-code-management'

const PAGE_SIZE = 10

type ConfirmRequest = {
  title: string
  description: string
  confirmLabel: string
  resolve: (confirmed: boolean) => void
}

function toRebindSelectValue(value: boolean | null | undefined) {
  if (value === true) return 'enabled'
  if (value === false) return 'disabled'
  return 'inherit'
}

function AdminLicensesContainer() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useOptionalToast()

  const filters = React.useMemo(
    () => parseAdminLicensesFilterQuery(searchParams),
    [searchParams],
  )
  const filtersKey = JSON.stringify(filters)

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

  const { projects, codeList, fetchProjects, fetchCodeList } = useDashboardData()
  const [pageError, setPageError] = React.useState<string | null>(null)
  const [actionLoading, setActionLoading] = React.useState(false)
  const [confirmRequest, setConfirmRequest] = React.useState<ConfirmRequest | null>(null)

  const fetchActivationCodeDetail = React.useCallback(async (id: number) => {
    try {
      const response = await fetch(`/api/admin/codes/${id}`)
      const data = await response.json()
      if (data.success) {
        return data.activationCode as ActivationCode
      }
    } catch (error) {
      console.error('获取激活码详情失败:', error)
    }
    return null
  }, [])

  const requestConfirmation = React.useCallback((message: string) => {
    return new Promise<boolean>((resolve) => {
      setConfirmRequest({
        title: message,
        description: '该操作不可撤销，请确认影响范围。',
        confirmLabel: '确认',
        resolve,
      })
    })
  }, [])

  const fetchCurrentCodePage = React.useCallback(async () => {
    const list = await fetchCodeList({
      keyword: filters.keyword,
      status: filters.status,
      projectKey: filters.projectKey,
      cardType: filters.cardType,
      page: filters.page,
      pageSize: PAGE_SIZE,
    })
    return list.codes
  }, [fetchCodeList, filters])

  const codeMgmt = useActivationCodeManagement({
    allCodes: [],
    onShowMessage: showMessage,
    onLoadingChange: setActionLoading,
    onFetchAllCodes: fetchCurrentCodePage,
    onFetchActivationCodeDetail: fetchActivationCodeDetail,
    onConfirmRequest: requestConfirmation,
  })

  // 首载项目下拉；筛选变化（防抖）时拉取对应服务端分页
  React.useEffect(() => {
    void fetchProjects()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setPageError(null)
      void fetchCodeList({
        keyword: filters.keyword,
        status: filters.status,
        projectKey: filters.projectKey,
        cardType: filters.cardType,
        page: filters.page,
        pageSize: PAGE_SIZE,
      }).catch(() => {
        setPageError('激活码列表加载失败，请重试')
      })
    }, 250)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey])

  const updateFilters = React.useCallback(
    (patch: Partial<AdminLicensesFilterState>) => {
      const next = { ...filters, ...patch }
      const query = buildAdminLicensesFilterQuery(next)
      router.replace(query ? `/admin/licenses?${query}` : '/admin/licenses', { scroll: false })
    },
    [filters, router],
  )

  const handleExport = React.useCallback(() => {
    const params = new URLSearchParams()
    if (filters.keyword.trim()) params.set('keyword', filters.keyword.trim())
    if (filters.status !== 'all') params.set('status', filters.status)
    if (filters.projectKey !== 'all') params.set('projectKey', filters.projectKey)
    if (filters.cardType !== 'all') params.set('cardType', filters.cardType)
    void fetch(`/api/admin/codes/list?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          exportCodesCsv(data.codes as ActivationCode[])
        } else {
          showMessage('导出失败', 'error')
        }
      })
      .catch(() => showMessage('导出失败', 'error'))
  }, [filters, showMessage])

  const startIndex =
    codeList.total === 0 ? 0 : (codeList.page - 1) * PAGE_SIZE + 1
  const endIndex = Math.min(codeList.page * PAGE_SIZE, codeList.total)

  const detail = codeMgmt.selectedActivationCodeDetail
  const policyDirty =
    detail !== null &&
    (codeMgmt.selectedActivationCodeRebindPolicy !== toRebindSelectValue(detail.allowAutoRebind) ||
      codeMgmt.selectedActivationCodeRebindCooldownMinutes.trim() !==
        (detail.autoRebindCooldownMinutes === null
          ? ''
          : String(detail.autoRebindCooldownMinutes)) ||
      codeMgmt.selectedActivationCodeRebindMaxCount.trim() !==
        (detail.autoRebindMaxCount === null ? '' : String(detail.autoRebindMaxCount)) ||
      codeMgmt.selectedActivationCodeAdminReason.trim() !== '')

  const policyDraft: LicensePolicyDraft = {
    policyValue: codeMgmt.selectedActivationCodeRebindPolicy,
    cooldownValue: codeMgmt.selectedActivationCodeRebindCooldownMinutes,
    maxCountValue: codeMgmt.selectedActivationCodeRebindMaxCount,
    reason: codeMgmt.selectedActivationCodeAdminReason,
  }

  return (
    <>
      <LicensesPage
        loading={actionLoading}
        error={pageError}
        onRetry={() => {
          setPageError(null)
          void fetchCodeList({
            keyword: filters.keyword,
            status: filters.status,
            projectKey: filters.projectKey,
            cardType: filters.cardType,
            page: filters.page,
            pageSize: PAGE_SIZE,
          })
        }}
        filters={filters}
        onFiltersChange={updateFilters}
        projectOptions={projects}
        availableCardTypes={
          codeList.availableCardTypes.length > 0 ? codeList.availableCardTypes : []
        }
        statusSummary={{
          unused: codeList.statusSummary?.unused ?? 0,
          inUse: codeList.statusSummary?.inUse ?? 0,
          risk: codeList.statusSummary?.risk ?? 0,
        }}
        codes={codeList.codes}
        pagination={{
          currentPage: codeList.page,
          totalPages: codeList.totalPages,
          totalItems: codeList.total,
          startIndex,
          endIndex,
        }}
        onPageChange={(page) => updateFilters({ page })}
        onCopyCode={(code) => {
          void navigator.clipboard
            ?.writeText(code)
            .then(() => showMessage('激活码已复制'))
            .catch(() => showMessage('当前环境不支持自动复制，请手动复制', 'error'))
        }}
        onDeleteRequest={(code) => {
          void codeMgmt.handleDeleteCode(code.id)
        }}
        onOpenDetail={(code) => {
          codeMgmt.selectActivationCodeForManagement(code.id)
        }}
        onExport={handleExport}
        onCleanupRequest={() => {
          void codeMgmt.handleCleanupExpired()
        }}
      />

      <LicenseDetailDrawer
        open={detail !== null}
        onOpenChange={(open) => {
          if (!open) codeMgmt.syncSelectedActivationCodeDrafts(null)
        }}
        detail={detail}
        policyDraft={policyDraft}
        onPolicyDraftChange={(patch) => {
          if (patch.policyValue !== undefined)
            codeMgmt.setSelectedActivationCodeRebindPolicy(patch.policyValue)
          if (patch.cooldownValue !== undefined)
            codeMgmt.setSelectedActivationCodeRebindCooldownMinutes(patch.cooldownValue)
          if (patch.maxCountValue !== undefined)
            codeMgmt.setSelectedActivationCodeRebindMaxCount(patch.maxCountValue)
          if (patch.reason !== undefined)
            codeMgmt.setSelectedActivationCodeAdminReason(patch.reason)
        }}
        policyDirty={policyDirty}
        machineTarget={codeMgmt.selectedActivationCodeTargetMachineId}
        onMachineTargetChange={codeMgmt.setSelectedActivationCodeTargetMachineId}
        loading={actionLoading}
        onSavePolicy={() => {
          void codeMgmt.handleSaveActivationCodeRebindSettings()
        }}
        onForceUnbind={() => {
          void codeMgmt.handleForceUnbindActivationCode()
        }}
        onForceRebind={() => {
          void codeMgmt.handleForceRebindActivationCode()
        }}
        onDelete={() => {
          if (detail) {
            void codeMgmt.handleDeleteCode(detail.id)
          }
        }}
        onCopyCode={(code) => {
          void navigator.clipboard
            ?.writeText(code)
            .then(() => showMessage('激活码已复制'))
            .catch(() => showMessage('当前环境不支持自动复制，请手动复制', 'error'))
        }}
      />

      <ConfirmDialog
        open={confirmRequest !== null}
        onOpenChange={(open) => {
          if (!open && confirmRequest) {
            confirmRequest.resolve(false)
            setConfirmRequest(null)
          }
        }}
        title={confirmRequest?.title ?? ''}
        description={confirmRequest?.description}
        confirmLabel={confirmRequest?.confirmLabel}
        destructive
        loading={actionLoading}
        onConfirm={() => {
          confirmRequest?.resolve(true)
          setConfirmRequest(null)
        }}
      />
    </>
  )
}

export default function AdminLicensesPage() {
  return (
    <AdminShell activeTab="list">
      <Suspense fallback={null}>
        <AdminLicensesContainer />
      </Suspense>
    </AdminShell>
  )
}
