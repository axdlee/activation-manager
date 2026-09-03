import { useState, useCallback } from 'react'

import type { ActivationCode } from './dashboard-page-types'
import { parseNullableCooldownMinutesInput, parseNullableMaxCountInput, normalizeOptionalAdminReason } from './dashboard-form-utils'
import { fromRebindOverrideSelectValue, toRebindOverrideSelectValue } from './license-rebind-policy'

export type UseActivationCodeManagementOptions = {
  allCodes: ActivationCode[]
  onShowMessage?: (message: string, type?: 'success' | 'error') => void
  onLoadingChange?: (loading: boolean) => void
  onFetchAllCodes?: () => Promise<ActivationCode[]>
  onFetchStats?: () => Promise<void>
}

export function useActivationCodeManagement(options: UseActivationCodeManagementOptions) {
  const { allCodes, onShowMessage, onLoadingChange, onFetchAllCodes, onFetchStats } = options

  const [selectedActivationCodeId, setSelectedActivationCodeId] = useState<number | null>(null)
  const [selectedActivationCodeRebindPolicy, setSelectedActivationCodeRebindPolicy] = useState<string>('inherit')
  const [selectedActivationCodeRebindCooldownMinutes, setSelectedActivationCodeRebindCooldownMinutes] = useState('')
  const [selectedActivationCodeRebindMaxCount, setSelectedActivationCodeRebindMaxCount] = useState('')
  const [selectedActivationCodeTargetMachineId, setSelectedActivationCodeTargetMachineId] = useState('')
  const [selectedActivationCodeAdminReason, setSelectedActivationCodeAdminReason] = useState('')

  const syncSelectedActivationCodeDrafts = useCallback((activationCode: ActivationCode | null) => {
    if (!activationCode) {
      setSelectedActivationCodeId(null)
      setSelectedActivationCodeRebindPolicy('inherit')
      setSelectedActivationCodeRebindCooldownMinutes('')
      setSelectedActivationCodeRebindMaxCount('')
      setSelectedActivationCodeTargetMachineId('')
      setSelectedActivationCodeAdminReason('')
      return
    }

    setSelectedActivationCodeId(activationCode.id)
    setSelectedActivationCodeRebindPolicy(toRebindOverrideSelectValue(activationCode.allowAutoRebind))
    setSelectedActivationCodeRebindCooldownMinutes(
      activationCode.autoRebindCooldownMinutes === null
        ? ''
        : String(activationCode.autoRebindCooldownMinutes),
    )
    setSelectedActivationCodeRebindMaxCount(
      activationCode.autoRebindMaxCount === null
        ? ''
        : String(activationCode.autoRebindMaxCount),
    )
    setSelectedActivationCodeTargetMachineId('')
    setSelectedActivationCodeAdminReason('')
  }, [])

  const selectActivationCodeForManagement = useCallback(
    (activationCodeId: number) => {
      const matchedActivationCode = allCodes.find((code) => code.id === activationCodeId) || null
      syncSelectedActivationCodeDrafts(matchedActivationCode)
    },
    [allCodes, syncSelectedActivationCodeDrafts],
  )

  const refreshActivationCodesAndKeepSelection = useCallback(async () => {
    const refreshedCodes = await onFetchAllCodes?.() ?? []

    if (selectedActivationCodeId === null) {
      return refreshedCodes
    }

    const refreshedSelectedActivationCode =
      refreshedCodes.find((code) => code.id === selectedActivationCodeId) || null
    syncSelectedActivationCodeDrafts(refreshedSelectedActivationCode)

    return refreshedCodes
  }, [onFetchAllCodes, selectedActivationCodeId, syncSelectedActivationCodeDrafts])

  const handleSaveActivationCodeRebindSettings = useCallback(async () => {
    if (selectedActivationCodeId === null) {
      onShowMessage?.('请先选择一条激活码', 'error')
      return
    }

    try {
      onLoadingChange?.(true)
      const response = await fetch(`/api/admin/codes/${selectedActivationCodeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allowAutoRebind: fromRebindOverrideSelectValue(selectedActivationCodeRebindPolicy),
          autoRebindCooldownMinutes: parseNullableCooldownMinutesInput(
            selectedActivationCodeRebindCooldownMinutes,
          ),
          autoRebindMaxCount: parseNullableMaxCountInput(
            selectedActivationCodeRebindMaxCount,
          ),
          reason: normalizeOptionalAdminReason(selectedActivationCodeAdminReason),
        }),
      })

      const data = await response.json()
      if (data.success) {
        onShowMessage?.(data.message)
        await refreshActivationCodesAndKeepSelection()
        setSelectedActivationCodeAdminReason('')
      } else {
        onShowMessage?.(data.message || '更新激活码换绑策略失败', 'error')
      }
    } catch (error) {
      onShowMessage?.(error instanceof Error ? error.message : '网络错误，请重试', 'error')
    } finally {
      onLoadingChange?.(false)
    }
  }, [selectedActivationCodeId, selectedActivationCodeRebindPolicy, selectedActivationCodeRebindCooldownMinutes, selectedActivationCodeRebindMaxCount, selectedActivationCodeAdminReason, onShowMessage, onLoadingChange, refreshActivationCodesAndKeepSelection])

  const handleForceUnbindActivationCode = useCallback(async () => {
    if (selectedActivationCodeId === null) {
      onShowMessage?.('请先选择一条激活码', 'error')
      return
    }

    if (!confirm('确定要强制解绑这条激活码吗？这不会重置有效期和剩余次数。')) {
      return
    }

    try {
      onLoadingChange?.(true)
      const response = await fetch(`/api/admin/codes/${selectedActivationCodeId}/binding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'unbind',
          reason: normalizeOptionalAdminReason(selectedActivationCodeAdminReason),
        }),
      })

      const data = await response.json()
      if (data.success) {
        onShowMessage?.(data.message)
        await refreshActivationCodesAndKeepSelection()
        setSelectedActivationCodeAdminReason('')
      } else {
        onShowMessage?.(data.message || '强制解绑失败', 'error')
      }
    } catch (error) {
      onShowMessage?.(error instanceof Error ? error.message : '网络错误，请重试', 'error')
    } finally {
      onLoadingChange?.(false)
    }
  }, [selectedActivationCodeId, selectedActivationCodeAdminReason, onShowMessage, onLoadingChange, refreshActivationCodesAndKeepSelection])

  const handleForceRebindActivationCode = useCallback(async () => {
    if (selectedActivationCodeId === null) {
      onShowMessage?.('请先选择一条激活码', 'error')
      return
    }

    const machineId = selectedActivationCodeTargetMachineId.trim()
    if (!machineId) {
      onShowMessage?.('请输入目标 machineId', 'error')
      return
    }

    if (!confirm(`确定要将该激活码强制换绑到设备「${machineId}」吗？`)) {
      return
    }

    try {
      onLoadingChange?.(true)
      const response = await fetch(`/api/admin/codes/${selectedActivationCodeId}/binding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rebind',
          machineId,
          reason: normalizeOptionalAdminReason(selectedActivationCodeAdminReason),
        }),
      })

      const data = await response.json()
      if (data.success) {
        onShowMessage?.(data.message)
        await refreshActivationCodesAndKeepSelection()
        setSelectedActivationCodeTargetMachineId('')
        setSelectedActivationCodeAdminReason('')
      } else {
        onShowMessage?.(data.message || '强制换绑失败', 'error')
      }
    } catch (error) {
      onShowMessage?.(error instanceof Error ? error.message : '网络错误，请重试', 'error')
    } finally {
      onLoadingChange?.(false)
    }
  }, [selectedActivationCodeId, selectedActivationCodeTargetMachineId, selectedActivationCodeAdminReason, onShowMessage, onLoadingChange, refreshActivationCodesAndKeepSelection])

  const handleDeleteCode = useCallback(async (id: number) => {
    if (!confirm('确定要删除这个激活码吗？')) return

    try {
      const response = await fetch('/api/admin/codes/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })

      const data = await response.json()
      if (data.success) {
        onShowMessage?.('激活码删除成功')
        void refreshActivationCodesAndKeepSelection()
        void onFetchStats?.()
      } else {
        onShowMessage?.(data.message || '删除失败', 'error')
      }
    } catch (error) {
      onShowMessage?.('网络错误，请重试', 'error')
    }
  }, [onShowMessage, refreshActivationCodesAndKeepSelection, onFetchStats])

  const handleCleanupExpired = useCallback(async () => {
    if (!confirm('确定要清理所有过期激活码的绑定关系吗？这将允许之前绑定过期激活码的机器使用新激活码。')) return

    try {
      onLoadingChange?.(true)
      const response = await fetch('/api/admin/codes/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await response.json()
      if (data.success) {
        onShowMessage?.(data.message)
        void refreshActivationCodesAndKeepSelection()
        void onFetchStats?.()
      } else {
        onShowMessage?.(data.message || '清理失败', 'error')
      }
    } catch (error) {
      onShowMessage?.('网络错误，请重试', 'error')
    } finally {
      onLoadingChange?.(false)
    }
  }, [onShowMessage, onLoadingChange, refreshActivationCodesAndKeepSelection, onFetchStats])

  return {
    selectedActivationCodeId,
    setSelectedActivationCodeId,
    selectedActivationCodeRebindPolicy,
    setSelectedActivationCodeRebindPolicy,
    selectedActivationCodeRebindCooldownMinutes,
    setSelectedActivationCodeRebindCooldownMinutes,
    selectedActivationCodeRebindMaxCount,
    setSelectedActivationCodeRebindMaxCount,
    selectedActivationCodeTargetMachineId,
    setSelectedActivationCodeTargetMachineId,
    selectedActivationCodeAdminReason,
    setSelectedActivationCodeAdminReason,
    syncSelectedActivationCodeDrafts,
    selectActivationCodeForManagement,
    refreshActivationCodesAndKeepSelection,
    handleSaveActivationCodeRebindSettings,
    handleForceUnbindActivationCode,
    handleForceRebindActivationCode,
    handleDeleteCode,
    handleCleanupExpired,
  }
}