import { type SystemConfigItem, type SystemConfigValue } from './system-config-ui'
import { isSensitiveSystemConfigKey } from './system-config-rules'

export type PersistableSystemConfigItem = {
  key: string
  value: SystemConfigValue
  description?: string
}

function shouldSkipSystemConfigUpdate(config: SystemConfigItem) {
  return isSensitiveSystemConfigKey(config.key) && config.value === ''
}

export function prepareSystemConfigUpdates(configs: SystemConfigItem[]): PersistableSystemConfigItem[] {
  return configs.flatMap((config) => {
    if (shouldSkipSystemConfigUpdate(config)) {
      return []
    }

    return [
      {
        key: config.key,
        value: config.value,
        description: config.description ?? undefined,
      },
    ]
  })
}
