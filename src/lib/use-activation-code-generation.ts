import { useState, useCallback } from 'react'
import type { ActivationCode } from './dashboard-page-types'
import { parseNullableCooldownMinutesInput, parseNullableMaxCountInput } from './dashboard-form-utils'
import { fromRebindOverrideSelectValue } from './license-rebind-policy'

export type UseActivationCodeGenerationOptions = {
  selectedProjectKey: string
  licenseMode: 'TIME' | 'COUNT'
  cardTypes: Array<{ name: string; days: number }>
  refreshCodesOnGenerate?: boolean
  isLoading?: boolean
  onShowMessage?: (message: string, type?: 'success' | 'error') => void
  onLoadingChange?: (loading: boolean) => void
  onFetchStats?: () => Promise<void>
  onFetchAllCodes?: () => Promise<void | unknown[]>
}

export function useActivationCodeGeneration(options: UseActivationCodeGenerationOptions) {
  const { selectedProjectKey, licenseMode, cardTypes, refreshCodesOnGenerate = false, isLoading = false, onShowMessage, onLoadingChange, onFetchStats, onFetchAllCodes } = options

  const [amount, setAmount] = useState(1)
  const [expiryDays, setExpiryDays] = useState(30)
  const [selectedCardType, setSelectedCardType] = useState<string>('')
  const [customDays, setCustomDays] = useState(30)
  const [totalCount, setTotalCount] = useState(10)
  const [generateRebindPolicy, setGenerateRebindPolicy] = useState<string>('inherit')
  const [generateRebindCooldownMinutes, setGenerateRebindCooldownMinutes] = useState('')
  const [generateRebindMaxCount, setGenerateRebindMaxCount] = useState('')
  const [generatedCodes, setGeneratedCodes] = useState<ActivationCode[]>([])

  const handleCardTypeSelection = useCallback((cardType: string) => {
    setSelectedCardType(cardType)
    const selected = cardTypes.find((item) => item.name === cardType)
    if (selected && selected.days > 0) {
      setExpiryDays(selected.days)
    }
  }, [cardTypes])

  const handleGenerateCodes = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoading) return
    onLoadingChange?.(true)

    try {
      const finalExpiryDays = selectedCardType === '自定义' ? customDays : expiryDays
      const finalCardType = selectedCardType || null
      const payload = {
        amount,
        projectKey: selectedProjectKey,
        licenseMode,
        expiryDays: licenseMode === 'TIME' ? finalExpiryDays : null,
        totalCount: licenseMode === 'COUNT' ? totalCount : null,
        cardType: licenseMode === 'TIME' ? finalCardType : null,
        allowAutoRebind: fromRebindOverrideSelectValue(generateRebindPolicy),
        autoRebindCooldownMinutes: parseNullableCooldownMinutesInput(generateRebindCooldownMinutes),
        autoRebindMaxCount: parseNullableMaxCountInput(generateRebindMaxCount),
      }

      const response = await fetch('/api/admin/codes/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (data.success) {
        setGeneratedCodes(data.codes)
        onShowMessage?.(data.message)
        await onFetchStats?.()
        if (refreshCodesOnGenerate) {
          await onFetchAllCodes?.()
        }
      } else {
        onShowMessage?.(data.message || '生成失败', 'error')
      }
    } catch (error) {
      onShowMessage?.(error instanceof Error ? error.message : '网络错误，请重试', 'error')
    } finally {
      onLoadingChange?.(false)
    }
  }, [amount, selectedProjectKey, licenseMode, selectedCardType, customDays, expiryDays, totalCount, generateRebindPolicy, generateRebindCooldownMinutes, generateRebindMaxCount, refreshCodesOnGenerate, isLoading, onShowMessage, onLoadingChange, onFetchStats, onFetchAllCodes])

  return {
    amount, setAmount,
    expiryDays, setExpiryDays,
    selectedCardType, setSelectedCardType,
    customDays, setCustomDays,
    totalCount, setTotalCount,
    generateRebindPolicy, setGenerateRebindPolicy,
    generateRebindCooldownMinutes, setGenerateRebindCooldownMinutes,
    generateRebindMaxCount, setGenerateRebindMaxCount,
    generatedCodes, setGeneratedCodes,
    handleCardTypeSelection,
    handleGenerateCodes,
  }
}