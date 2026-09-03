import { useState, useCallback } from 'react'

import type { ActivationCode } from './dashboard-page-types'
import { parseNullableCooldownMinutesInput, parseNullableMaxCountInput, normalizeOptionalAdminReason } from './dashboard-form-utils'
import { fromRebindOverrideSelectValue, toRebindOverrideSelectValue } from './license-rebind-policy'

export type UseActivationCodeManagementOptions = {
  allCodes: ActivationCode[]
  onShowMessage?: (message: string, type?: 'success' | 'error') => void
  onLoadingChange?: (loading: boolean) => void
  onFetchAllCodes?: () => Promise<ActivationCode[]>
  // 单码详情（含绑定历史与管理员审计），列表不再嵌套返回
  onFetchActivationCodeDetail?: (id: number) => Promise<ActivationCode | null>
  onFetchStats?: () => Promise<void>
}

export function useActivationCodeManagement(options: UseActivationCodeManagementOptions) {
  const { allCodes, onShowMessage, onLoadingChange, onFetchAllCodes, onFetchActivationCodeDetail, onFetchStats } = options

  const [selectedActivationCodeId, setSelectedActivationCodeId] = useState<number | null>(null)
  const [selectedActivationCodeDetail, setSelectedActivationCodeDetail] = useState<ActivationCode | null>(null)
  const [selectedActivationCodeRebindPolicy, setSelectedActivationCodeRebindPolicy] = useState<string>('inherit')
  const [selectedActivationCodeRebindCooldownMinutes, setSelectedActivationCodeRebindCooldownMinutes] = useState('')
  const [selectedActivationCodeRebindMaxCount, setSelectedActivationCodeRebindMaxCount] = useState('')
  const [selectedActivationCodeTargetMachineId, setSelectedActivationCodeTargetMachineId] = useState('')
  const [selectedActivationCodeAdminReason, setSelectedActivationCodeAdminReason] = useState('')

  const syncSelectedActivationCodeDrafts = useCallback((activationCode: ActivationCode | null) => {
    if (!activationCode) {
      setSelectedActivationCodeId(null)
      setSelectedActivationCodeDetail(null)
      setSelectedActivationCodeRebindPolicy('inherit')
      setSelectedActivationCodeRebindCooldownMinutes('')
      setSelectedActivationCodeRebindMaxCount('')
      setSelectedActivationCodeTargetMachineId('')
      setSelectedActivationCodeAdminReason('')
      return
    }

    setSelectedActivationCodeId(activationCode.id)
    setSelectedActivationCodeDetail(activationCode)
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

  // 从列表记录回退同步基础草稿（列表不含绑定历史/审计，用于打开弹框的即时态）
  const fallbackSyncFromList = useCallback(
    (activationCodeId: number) => {
      const matched = allCodes.find((code) => code.id === activationCodeId) || null
      if (!matched) {
        return
      }

      setSelectedActivationCodeId(matched.id)
      setSelectedActivationCodeRebindPolicy(toRebindOverrideSelectValue(matched.allowAutoRebind))
      setSelectedActivationCodeRebindCooldownMinutes(
        matched.autoRebindCooldownMinutes === null ? '' : String(matched.autoRebindCooldownMinutes),
      )
      setSelectedActivationCodeRebindMaxCount(
        matched.autoRebindMaxCount === null ? '' : String(matched.autoRebindMaxCount),
      )
    },
    [allCodes],
  )

  const selectActivationCodeForManagement = useCallback(
    (activationCodeId: number) => {
      fallbackSyncFromList(activationCodeId)

      // 异步拉取单码详情（绑定历史 + 管理员审计），完成后覆盖基础草稿
      if (onFetchActivationCodeDetail) {
        void onFetchActivationCodeDetail(activationCodeId)
          .then((detail) => {
            if (detail) {
              syncSelectedActivationCodeDrafts(detail)
            }
          })
          .catch(() => undefined)
      }
    },
    [fallbackSyncFromList, onFetchActivationCodeDetail, syncSelectedActivationCodeDrafts],
  )

  const refreshActivationCodesAndKeepSelection = useCallback(async () => {
    const refreshedCodes = await onFetchAllCodes?.() ?? []

    if (selectedActivationCodeId === null) {
      return refreshedCodes
    }

    // 列表不再含详情，重新拉单码详情以保持弹框数据新鲜
    if (onFetchActivationCodeDetail) {
      const detail = await onFetchActivationCodeDetail(selectedActivationCodeId).catch(() => null)
      if (detail) {
        syncSelectedActivationCodeDrafts(detail)
        return refreshedCodes
      }
    }

    const refreshedSelectedActivationCode =
      refreshedCodes.find((code) => code.id === selectedActivationCodeId) || null
    syncSelectedActivationCodeDrafts(refreshedSelectedActivationCode)

    return refreshedCodes
  }, [onFetchAllCodes, onFetchActivationCodeDetail, selectedActivationCodeId, syncSelectedActivationCodeDrafts])

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
    selectedActivationCodeDetail,
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