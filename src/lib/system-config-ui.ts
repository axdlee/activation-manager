export type SystemConfigValue = string | number | string[]

export type SystemConfigItem = {
  key: string
  value: SystemConfigValue
  description?: string | null
  sensitive?: boolean
  masked?: boolean
  hasValue?: boolean
}

type SystemConfigInputKind = 'text' | 'password' | 'number' | 'select' | 'textarea'
type SystemConfigCardLayout = 'default' | 'full'
type SystemConfigBadgeTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral'

type SystemConfigOption = {
  label: string
  value: string
}

type SystemConfigBadge = {
  label: string
  tone: SystemConfigBadgeTone
}

type SystemConfigDisplayItem = {
  key: string
  label: string
  description: string
  hint: string
  value: SystemConfigValue
  inputKind: SystemConfigInputKind
  options?: SystemConfigOption[]
  placeholder?: string
  sensitive?: boolean
  masked?: boolean
  hasValue?: boolean
  layout: SystemConfigCardLayout
  badges?: SystemConfigBadge[]
  previewTokens?: string[]
}

type SystemConfigGroupKey = 'access' | 'security' | 'branding' | 'advanced'

type SystemConfigGroup = {
  key: SystemConfigGroupKey
  title: string
  description: string
  badge: string
  items: SystemConfigDisplayItem[]
}

type SystemConfigSummaryCard = {
  label: string
  value: string
  description: string
}

const jwtExpiryOptions: SystemConfigOption[] = [
  { label: '1 小时', value: '1h' },
  { label: '6 小时', value: '6h' },
  { label: '12 小时', value: '12h' },
  { label: '24 小时', value: '24h' },
  { label: '7 天', value: '7d' },
]

const groupMetaMap: Record<Exclude<SystemConfigGroupKey, 'advanced'>, Omit<SystemConfigGroup, 'items'>> = {
  access: {
    key: 'access',
    title: '访问控制',
    description: '限定后台入口允许的访问来源，减少暴露面。',
    badge: '网络',
  },
  security: {
    key: 'security',
    title: '认证与会话',
    description: '集中管理 JWT 密钥、登录时长与密码哈希成本。',
    badge: '安全',
  },
  branding: {
    key: 'branding',
    title: '系统展示',
    description: '维护后台面向管理员的系统名称与识别信息。',
    badge: '展示',
  },
}

const advancedGroupMeta: Omit<SystemConfigGroup, 'items'> = {
  key: 'advanced',
  title: '高级配置',
  description: '未归类的扩展配置会在这里展示，方便继续演进。',
  badge: '扩展',
}

const groupItemOrderMap: Partial<Record<SystemConfigGroupKey, string[]>> = {
  access: ['allowedIPs'],
  security: ['jwtSecret', 'jwtExpiresIn', 'bcryptRounds'],
  branding: ['systemName'],
}

function humanizeConfigKey(key: string) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase())
}

function normalizeTokenList(value: SystemConfigValue) {
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter(Boolean)
  }

  return String(value || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
}

function resolveWhitelistBadges(value: SystemConfigValue): SystemConfigBadge[] {
  const whitelistEntries = normalizeTokenList(value)

  if (whitelistEntries.length === 0) {
    return [{ label: '未配置白名单', tone: 'warning' }]
  }

  return [{ label: `${whitelistEntries.length} 个地址`, tone: 'info' }]
}

function resolveJwtExpiresInBadges(value: SystemConfigValue): SystemConfigBadge[] {
  const normalizedValue = String(value)

  if (normalizedValue === '7d') {
    return [{ label: '时长偏长', tone: 'warning' }]
  }

  if (normalizedValue === '1h') {
    return [{ label: '偏安全', tone: 'info' }]
  }

  if (normalizedValue === '6h' || normalizedValue === '12h' || normalizedValue === '24h') {
    return [{ label: '推荐时长', tone: 'success' }]
  }

  return []
}

function resolveBcryptRoundsBadges(value: SystemConfigValue): SystemConfigBadge[] {
  const rounds = Number(value)

  if (Number.isNaN(rounds)) {
    return []
  }

  if (rounds < 10) {
    return [{ label: '强度偏低', tone: 'warning' }]
  }

  if (rounds <= 12) {
    return [{ label: '推荐强度', tone: 'success' }]
  }

  return [{ label: '高强度', tone: 'info' }]
}

function resolveSensitiveConfigBadges(config: SystemConfigItem): SystemConfigBadge[] {
  const badges: SystemConfigBadge[] = [{ label: '敏感配置', tone: 'danger' }]

  if (!config.masked) {
    return badges
  }

  badges.push({
    label: config.hasValue ? '已配置' : '未配置',
    tone: config.hasValue ? 'success' : 'warning',
  })

  return badges
}

function resolveDisplayItem(config: SystemConfigItem): SystemConfigDisplayItem {
  switch (config.key) {
    case 'allowedIPs':
      return {
        key: config.key,
        label: '访问白名单',
        description: '仅允许白名单中的 IP 访问管理后台。',
        hint: '每行填写一个 IP 地址；本地开发建议保留 127.0.0.1 与 ::1。',
        value: config.value,
        inputKind: 'textarea',
        placeholder: '127.0.0.1\n::1',
        layout: 'full',
        badges: resolveWhitelistBadges(config.value),
        previewTokens: normalizeTokenList(config.value),
      }
    case 'jwtSecret':
      return {
        key: config.key,
        label: 'JWT 密钥',
        description: '用于签发和校验登录态，修改后现有会话会失效。',
        hint: config.masked
          ? config.hasValue
            ? '当前密钥已配置，留空可保持不变；输入新值后会立即覆盖旧密钥。'
            : '当前尚未配置 JWT 密钥，请尽快设置一个足够长的随机字符串。'
          : '建议使用足够长的随机字符串，并妥善保管。',
        value: config.value,
        inputKind: 'password',
        sensitive: true,
        masked: config.masked,
        hasValue: config.hasValue,
        placeholder: config.hasValue ? '如需更新，请输入新的 JWT 密钥' : '请输入新的 JWT 密钥',
        layout: 'full',
        badges: resolveSensitiveConfigBadges(config),
      }
    case 'jwtExpiresIn':
      return {
        key: config.key,
        label: '登录有效期',
        description: '控制管理员登录态保持时间。',
        hint: '时间越长越方便，越短越安全；推荐在 6 小时到 24 小时之间。',
        value: config.value,
        inputKind: 'select',
        options: jwtExpiryOptions,
        layout: 'default',
        badges: resolveJwtExpiresInBadges(config.value),
      }
    case 'bcryptRounds':
      return {
        key: config.key,
        label: '密码哈希强度',
        description: '用于管理员密码的 bcrypt 成本轮数。',
        hint: '推荐 10-12；越高越安全，但登录和修改密码也会更慢。',
        value: config.value,
        inputKind: 'number',
        layout: 'default',
        badges: resolveBcryptRoundsBadges(config.value),
      }
    case 'systemName':
      return {
        key: config.key,
        label: '系统名称',
        description: '后台、登录页等区域的系统展示名称。',
        hint: '适合设置为团队内部熟悉的品牌或产品名称。',
        value: config.value,
        inputKind: 'text',
        placeholder: '例如：浏览器插件授权中心',
        layout: 'full',
        badges: [{ label: '品牌识别', tone: 'neutral' }],
      }
    default:
      return {
        key: config.key,
        label: humanizeConfigKey(config.key),
        description: config.description || '自定义系统配置项',
        hint: '当前为未归类的扩展配置，将按原始值直接保存。',
        value: config.value,
        inputKind: 'text',
        placeholder: `请输入${config.description || config.key}`,
        layout: 'default',
      }
  }
}

function resolveGroupKey(configKey: string): SystemConfigGroupKey {
  if (configKey === 'allowedIPs') {
    return 'access'
  }

  if (configKey === 'jwtSecret' || configKey === 'jwtExpiresIn' || configKey === 'bcryptRounds') {
    return 'security'
  }

  if (configKey === 'systemName') {
    return 'branding'
  }

  return 'advanced'
}

function formatWhitelistValue(value: SystemConfigValue) {
  if (Array.isArray(value)) {
    return `${value.length} 个地址`
  }

  return value ? '已配置' : '未配置'
}

function formatRoundsValue(value: SystemConfigValue) {
  return `${String(value)} 轮`
}

function sortGroupItems(groupKey: SystemConfigGroupKey, items: SystemConfigDisplayItem[]) {
  const preferredOrder = groupItemOrderMap[groupKey] || []

  return [...items].sort((currentItem, nextItem) => {
    const currentOrderIndex = preferredOrder.indexOf(currentItem.key)
    const nextOrderIndex = preferredOrder.indexOf(nextItem.key)
    const normalizedCurrentOrderIndex =
      currentOrderIndex === -1 ? Number.MAX_SAFE_INTEGER : currentOrderIndex
    const normalizedNextOrderIndex =
      nextOrderIndex === -1 ? Number.MAX_SAFE_INTEGER : nextOrderIndex

    if (normalizedCurrentOrderIndex !== normalizedNextOrderIndex) {
      return normalizedCurrentOrderIndex - normalizedNextOrderIndex
    }

    return currentItem.label.localeCompare(nextItem.label, 'zh-CN')
  })
}

export function buildSystemConfigPageModel(configs: SystemConfigItem[]) {
  const groupedItems = new Map<SystemConfigGroupKey, SystemConfigDisplayItem[]>()

  configs.forEach((config) => {
    const groupKey = resolveGroupKey(config.key)
    const displayItem = resolveDisplayItem(config)
    const items = groupedItems.get(groupKey) || []
    groupedItems.set(groupKey, [...items, displayItem])
  })

  const groups: SystemConfigGroup[] = [
    ...Object.values(groupMetaMap)
      .map((group) => ({
        ...group,
        items: sortGroupItems(group.key, groupedItems.get(group.key) || []),
      }))
      .filter((group) => group.items.length > 0),
    ...(groupedItems.get('advanced')?.length
      ? [
          {
            ...advancedGroupMeta,
            items: sortGroupItems('advanced', groupedItems.get('advanced') || []),
          },
        ]
      : []),
  ]

  const allowedIPs = configs.find((config) => config.key === 'allowedIPs')?.value || []
  const jwtExpiresIn = configs.find((config) => config.key === 'jwtExpiresIn')?.value || '--'
  const bcryptRounds = configs.find((config) => config.key === 'bcryptRounds')?.value || '--'

  const summaryCards: SystemConfigSummaryCard[] = [
    {
      label: '配置项',
      value: String(configs.length),
      description: '当前已加载的系统配置总数',
    },
    {
      label: '访问白名单',
      value: formatWhitelistValue(allowedIPs),
      description: '后台访问来源将按白名单限制',
    },
    {
      label: '登录会话',
      value: String(jwtExpiresIn),
      description: 'JWT 登录态有效期',
    },
    {
      label: '密码强度',
      value: formatRoundsValue(bcryptRounds),
      description: 'bcrypt 哈希成本',
    },
  ]

  return {
    groups,
    summaryCards,
  }
}
