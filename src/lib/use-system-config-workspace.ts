import { useCallback, useState } from 'react'

import { prepareSystemConfigUpdates } from './system-config-updates'
import { buildSystemConfigPageModel, type SystemConfigItem } from './system-config-ui'

export type UseSystemConfigWorkspaceOptions = {
  systemConfigs: SystemConfigItem[]
  setSystemConfigs: React.Dispatch<React.SetStateAction<SystemConfigItem[]>>
  onShowMessage?: (message: string, type?: 'success' | 'error') => void
  onLoadingChange?: (loading: boolean) => void
  onFetchSystemConfigs?: () => Promise<boolean | void>
}

export function useSystemConfigWorkspace(options: UseSystemConfigWorkspaceOptions) {
  const {
    systemConfigs,
    setSystemConfigs,
    onShowMessage,
    onLoadingChange,
    onFetchSystemConfigs,
  } = options
  const [revealedSensitiveConfigKeys, setRevealedSensitiveConfigKeys] = useState<string[]>([])
  const [revealedPasswordFieldKeys, setRevealedPasswordFieldKeys] = useState<string[]>([])

  const updateConfigValue = useCallback(
    (key: string, value: SystemConfigItem['value']) => {
      setSystemConfigs((prev) =>
        prev.map((config) => (config.key === key ? { ...config, value } : config)),
      )
    },
    [setSystemConfigs],
  )

  const handleUpdateSystemConfig = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      onLoadingChange?.(true)
      onShowMessage?.('')

      try {
        const configs = prepareSystemConfigUpdates(systemConfigs)
        const response = await fetch('/api/admin/system-config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ configs }),
        })

        const data = await response.json()
        if (data.success) {
          onShowMessage?.(data.message)
          await onFetchSystemConfigs?.()
          setRevealedSensitiveConfigKeys([])
        } else {
          onShowMessage?.(data.message || '系统配置更新失败', 'error')
        }
      } catch (error) {
        onShowMessage?.('网络错误，请重试', 'error')
      } finally {
        onLoadingChange?.(false)
      }
    },
    [systemConfigs, onLoadingChange, onShowMessage, onFetchSystemConfigs],
  )

  const togglePasswordFieldVisibility = useCallback((key: string) => {
    setRevealedPasswordFieldKeys((currentKeys) =>
      currentKeys.includes(key)
        ? currentKeys.filter((currentKey) => currentKey !== key)
        : [...currentKeys, key],
    )
  }, [])

  const isPasswordFieldVisible = useCallback(
    (key: string) => revealedPasswordFieldKeys.includes(key),
    [revealedPasswordFieldKeys],
  )

  const toggleSensitiveConfigVisibility = useCallback((key: string) => {
    setRevealedSensitiveConfigKeys((currentKeys) =>
      currentKeys.includes(key)
        ? currentKeys.filter((currentKey) => currentKey !== key)
        : [...currentKeys, key],
    )
  }, [])

  const isSensitiveConfigVisible = useCallback(
    (key: string) => revealedSensitiveConfigKeys.includes(key),
    [revealedSensitiveConfigKeys],
  )

  const pageModel = buildSystemConfigPageModel(systemConfigs)
  const sensitiveCount = pageModel.groups.reduce(
    (count, group) => count + group.items.filter((item) => item.sensitive).length,
    0,
  )
  const whitelistEntryCount = pageModel.groups.reduce((count, group) => {
    return (
      count +
      group.items.filter(
        (item) =>
          item.key === 'allowedIPs' &&
          Array.isArray(item.value) &&
          (item.value as string[]).length > 0,
      ).length
    )
  }, 0)

  return {
    revealedSensitiveConfigKeys,
    setRevealedSensitiveConfigKeys,
    revealedPasswordFieldKeys,
    setRevealedPasswordFieldKeys,
    updateConfigValue,
    handleUpdateSystemConfig,
    togglePasswordFieldVisibility,
    isPasswordFieldVisible,
    toggleSensitiveConfigVisibility,
    isSensitiveConfigVisible,
    systemConfigPageModel: pageModel,
    systemConfigSensitiveCount: sensitiveCount,
    systemConfigWhitelistEntryCount: whitelistEntryCount,
  }
}