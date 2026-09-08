export type SystemConfigValue = string | number | boolean | string[]

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
export type SystemConfigBadgeTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral'

export type SystemConfigOption = {
  label: string
  value: string
}

export type SystemConfigBadge = {
  label: string
  tone: SystemConfigBadgeTone
}

export type SystemConfigDisplayItem = {
  key: string
  label: string
  description: string
  hint: string
  value: SystemConfigValue
  inputKind: SystemConfigInputKind
  options?: SystemConfigOption[]
  placeholder?: string
  min?: number
  max?: number
  step?: number
  sensitive?: boolean
  masked?: boolean
  hasValue?: boolean
  layout: SystemConfigCardLayout
  badges?: SystemConfigBadge[]
  previewTokens?: string[]
}

export type SystemConfigGroupKey =
  | 'access'
  | 'rebind'
  | 'security'
  | 'branding'
  | 'notification'
  | 'advanced'

export type SystemConfigGroup = {
  key: SystemConfigGroupKey
  title: string
  description: string
  badge: string
  items: SystemConfigDisplayItem[]
}

export type SystemConfigSummaryCard = {
  label: string
  value: string
  description: string
}

export type SystemConfigPageModel = {
  groups: SystemConfigGroup[]
  summaryCards: SystemConfigSummaryCard[]
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
  rebind: {
    key: 'rebind',
    title: '换绑策略',
    description: '维护系统级自助换绑默认策略；项目级与单码级可继续覆盖。',
    badge: '策略',
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
  notification: {
    key: 'notification',
    title: '通知与告警',
    description: '关键业务事件（到期、发卡、超时取消）可同时分发到 Webhook、邮件与短信。',
    badge: '通知',
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
  rebind: ['allowAutoRebind', 'autoRebindCooldownMinutes', 'autoRebindMaxCount', 'allowDeviceBinding'],
  security: ['jwtSecret', 'jwtExpiresIn', 'bcryptRounds', 'licenseResponseSecret'],
  branding: ['systemName', 'expiryWebhookUrl', 'shopEnabled'],
  notification: [
    'notifyWebhookUrl',
    'notifyEmailSmtpHost',
    'notifyEmailSmtpPort',
    'notifyEmailSmtpUser',
    'notifyEmailSmtpPass',
    'notifyEmailFrom',
    'notifyEmailTo',
    'notifySmsApiUrl',
    'notifySmsApiBody',
    'notifySmsPhones',
  ],
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

function resolveAutoRebindBadges(value: SystemConfigValue): SystemConfigBadge[] {
  return value === true
    ? [{ label: '允许自助换绑', tone: 'success' }]
    : [{ label: '默认禁止', tone: 'neutral' }]
}

function resolveAutoRebindCooldownBadges(value: SystemConfigValue): SystemConfigBadge[] {
  const cooldownMinutes = Number(value)

  if (!Number.isFinite(cooldownMinutes)) {
    return []
  }

  if (cooldownMinutes === 0) {
    return [{ label: '无冷却', tone: 'warning' }]
  }

  if (cooldownMinutes <= 60) {
    return [{ label: '短冷却', tone: 'info' }]
  }

  if (cooldownMinutes <= 24 * 60) {
    return [{ label: '推荐', tone: 'success' }]
  }

  return [{ label: '长冷却', tone: 'neutral' }]
}

function resolveAutoRebindMaxCountBadges(value: SystemConfigValue): SystemConfigBadge[] {
  const maxCount = Number(value)

  if (!Number.isFinite(maxCount)) {
    return []
  }

  if (maxCount === 0) {
    return [{ label: '不限制', tone: 'warning' }]
  }

  if (maxCount <= 3) {
    return [{ label: '限制较严', tone: 'info' }]
  }

  if (maxCount <= 10) {
    return [{ label: '推荐', tone: 'success' }]
  }

  return [{ label: '限制较宽', tone: 'neutral' }]
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

function resolveConfiguredBadges(value: SystemConfigValue, configuredLabel: string, unconfiguredLabel: string): SystemConfigBadge[] {
  const hasValue = typeof value === 'string' ? Boolean(value.trim()) : Boolean(value)
  return hasValue
    ? [{ label: configuredLabel, tone: 'success' }]
    : [{ label: unconfiguredLabel, tone: 'warning' }]
}

function resolveSensitiveConfigBadges(config: SystemConfigItem): SystemConfigBadge[] {  const badges: SystemConfigBadge[] = [{ label: '敏感配置', tone: 'danger' }]

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
    case 'allowAutoRebind':
      return {
        key: config.key,
        label: '系统级自助换绑策略',
        description: '作为系统级默认规则，控制激活码在满足条件时是否允许从旧设备自助迁移到新设备。',
        hint: '优先级：系统级配置 < 项目级配置 < 单码级配置。建议默认关闭，确实需要跨设备迁移时再开启。',
        value: config.value,
        inputKind: 'select',
        options: [
          { label: '默认禁止自助换绑', value: 'false' },
          { label: '默认允许自助换绑', value: 'true' },
        ],
        layout: 'default',
        badges: resolveAutoRebindBadges(config.value),
      }
    case 'autoRebindCooldownMinutes':
      return {
        key: config.key,
        label: '系统级换绑冷却时间',
        description: '作为系统级默认值，控制同一激活码两次自助换绑之间至少间隔多久。',
        hint: '单位为分钟；0 表示不设冷却。优先级：系统级配置 < 项目级配置 < 单码级配置。建议至少保留 60 分钟。',
        value: config.value,
        inputKind: 'number',
        min: 0,
        max: 30 * 24 * 60,
        step: 1,
        layout: 'default',
        badges: resolveAutoRebindCooldownBadges(config.value),
      }
    case 'autoRebindMaxCount':
      return {
        key: config.key,
        label: '系统级自助换绑次数上限',
        description: '作为系统级默认值，限制单个激活码最多还能自助迁移多少次设备。',
        hint: '单位为次；0 表示不限制。优先级：系统级配置 < 项目级配置 < 单码级配置。建议结合冷却时间共同使用。',
        value: config.value,
        inputKind: 'number',
        min: 0,
        max: 9999,
        step: 1,
        layout: 'default',
        badges: resolveAutoRebindMaxCountBadges(config.value),
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
    case 'shopEnabled':
      return {
        key: config.key,
        label: '启用购买中心',
        description: '是否对外开放购买中心：商品展示、下单、支付与自动发卡。',
        hint: '关闭后 /shop 购买页与下单 API 将不可用；后台购买中心管理仍可访问（用于维护商品与配置）。',
        value: config.value,
        inputKind: 'select',
        options: [
          { label: '启用购买中心', value: 'true' },
          { label: '停用购买中心', value: 'false' },
        ],
        layout: 'default',
        badges:
          config.value === true
            ? [{ label: '已启用', tone: 'success' }]
            : [{ label: '已停用', tone: 'warning' }],
      }
    case 'expiryWebhookUrl':
      return {
        key: config.key,
        label: '到期通知接口（旧）',
        description: '激活码到期或次数耗尽时的旧版通知入口；已配置「通用通知 Webhook」时此地址不再发送。',
        hint: '建议改用「通用通知 Webhook」统一接收所有事件。此地址仅在未配置通用 Webhook 时用于到期事件，且保持原有扁平 payload 格式。',
        value: config.value,
        inputKind: 'text',
        placeholder: 'https://example.com/hooks/license-expiry',
        layout: 'full',
        badges:
          typeof config.value === 'string' && config.value.trim()
            ? [{ label: '通知已启用', tone: 'success' }]
            : [{ label: '未启用', tone: 'warning' }],
      }
    case 'allowDeviceBinding':
      return {
        key: config.key,
        label: '启用设备绑定',
        description: '激活码是否绑定到首次激活的设备。关闭后，激活码不再记录绑定机器。',
        hint: '默认开启。关闭后同一激活码可在任意设备使用，适合无需设备锁定的授权场景。',
        value: config.value,
        inputKind: 'select',
        options: [
          { label: '启用设备绑定', value: 'true' },
          { label: '不绑定设备', value: 'false' },
        ],
        layout: 'default',
        badges:
          config.value === true
            ? [{ label: '已启用', tone: 'success' }]
            : [{ label: '未启用', tone: 'warning' }],
      }
    case 'licenseResponseSecret':
      return {
        key: config.key,
        label: '响应签名密钥',
        description: '为 License API 响应附加 HMAC-SHA256 签名，客户端 SDK 配置同一密钥后可验签防篡改。',
        hint: '留空表示不签名（向后兼容）；配置后 SDK 需同步配置 responseSecret，否则验签失败。建议使用足够长的随机字符串。',
        value: config.value,
        inputKind: 'password',
        sensitive: true,
        masked: config.masked,
        hasValue: config.hasValue,
        placeholder: config.hasValue ? '如需更新，请输入新的签名密钥' : '请输入新的签名密钥',
        layout: 'full',
        badges:
          typeof config.value === 'string' && config.value.trim()
            ? [{ label: '签名已启用', tone: 'success' }]
            : [{ label: '未启用', tone: 'warning' }],
      }
    case 'notifyWebhookUrl':
      return {
        key: config.key,
        label: '通用通知 Webhook',
        description: '关键业务事件（激活码到期、订单发卡、超时取消）发生时，向该地址 POST JSON 通知。',
        hint: '留空表示不通知。配置后激活码到期事件优先走此地址（不再发送下方旧「到期通知接口」）。接口需返回 2xx 视为成功。',
        value: config.value,
        inputKind: 'text',
        placeholder: 'https://example.com/hooks/activation-manager',
        layout: 'full',
        badges: resolveConfiguredBadges(config.value, '通知已启用', '未启用'),
      }
    case 'notifyEmailSmtpHost':
      return {
        key: config.key,
        label: '邮件通知 SMTP 服务器',
        description: '配置后到期、发卡等事件会同时发送邮件通知到下方收件人。',
        hint: '例如 smtp.qq.com、smtp.163.com；留空表示不启用邮件通知。邮箱需开启 SMTP 并使用授权码登录。',
        value: config.value,
        inputKind: 'text',
        placeholder: 'smtp.example.com',
        layout: 'default',
        badges: resolveConfiguredBadges(config.value, '邮件通知已启用', '邮件通知未启用'),
      }
    case 'notifyEmailSmtpPort':
      return {
        key: config.key,
        label: '邮件通知 SMTP 端口',
        description: 'SMTP 服务端口；465 使用 SSL 直连，其他端口按 STARTTLS/明文处理。',
        hint: '常用端口：465（SSL）或 587/25（STARTTLS）。',
        value: config.value,
        inputKind: 'number',
        min: 1,
        max: 65535,
        step: 1,
        layout: 'default',
        badges: [{ label: '默认 465', tone: 'neutral' }],
      }
    case 'notifyEmailSmtpUser':
      return {
        key: config.key,
        label: '邮件通知 SMTP 用户名',
        description: 'SMTP 登录用户名，通常为发件邮箱地址。',
        hint: '与密码/授权码同时填写才启用 SMTP 认证；使用无需认证的内网 SMTP 可留空。',
        value: config.value,
        inputKind: 'text',
        placeholder: 'notify@example.com',
        layout: 'default',
        badges: [],
      }
    case 'notifyEmailSmtpPass':
      return {
        key: config.key,
        label: '邮件通知 SMTP 密码/授权码',
        description: 'SMTP 登录密码或邮箱服务商提供的授权码。',
        hint: config.masked
          ? config.hasValue
            ? '当前授权码已配置，留空可保持不变；输入新值后会立即覆盖。'
            : '尚未配置 SMTP 授权码，请从邮箱服务商设置中生成后填写。'
          : '建议使用授权码而非邮箱登录密码，并妥善保管。',
        value: config.value,
        inputKind: 'password',
        sensitive: true,
        masked: config.masked,
        hasValue: config.hasValue,
        placeholder: config.hasValue ? '如需更新，请输入新的授权码' : '请输入 SMTP 密码/授权码',
        layout: 'full',
        badges: resolveSensitiveConfigBadges(config),
      }
    case 'notifyEmailFrom':
      return {
        key: config.key,
        label: '邮件通知发件人',
        description: '通知邮件展示的发件人地址。',
        hint: '留空时默认使用 SMTP 用户名作为发件人。',
        value: config.value,
        inputKind: 'text',
        placeholder: 'notify@example.com',
        layout: 'default',
        badges: [],
      }
    case 'notifyEmailTo':
      return {
        key: config.key,
        label: '邮件通知收件人',
        description: '接收通知邮件的管理员邮箱，可填写多个。',
        hint: '多个邮箱用逗号或换行分隔；未填写时邮件通知不启用。',
        value: config.value,
        inputKind: 'textarea',
        placeholder: 'admin@example.com',
        layout: 'full',
        badges: resolveConfiguredBadges(config.value, '收件人已配置', '未配置收件人'),
      }
    case 'notifySmsApiUrl':
      return {
        key: config.key,
        label: '短信通知网关地址',
        description: '通用 HTTP 短信网关；配置后关键事件会以短信形式发送到下方手机号。',
        hint: '兼容提交 JSON 的短信服务商（阿里云短信助手、短信宝等 HTTP 网关）；留空表示不启用短信通知。',
        value: config.value,
        inputKind: 'text',
        placeholder: 'https://sms.example.com/api/send',
        layout: 'full',
        badges: resolveConfiguredBadges(config.value, '短信通知已启用', '短信通知未启用'),
      }
    case 'notifySmsApiBody':
      return {
        key: config.key,
        label: '短信请求体模板',
        description: '发送短信时的 POST 请求体模板，占位符 {phone} 与 {content} 会被替换。',
        hint: '默认模板：{"phone":"{phone}","content":"{content}"}。按短信服务商接口文档调整字段名。',
        value: config.value,
        inputKind: 'textarea',
        placeholder: '{"phone":"{phone}","content":"{content}"}',
        layout: 'full',
        badges: [{ label: '支持 {phone} {content} 占位符', tone: 'neutral' }],
      }
    case 'notifySmsPhones':
      return {
        key: config.key,
        label: '短信接收手机号',
        description: '接收通知短信的管理员手机号，可填写多个。',
        hint: '多个手机号用逗号或换行分隔；未填写时短信通知不启用。',
        value: config.value,
        inputKind: 'textarea',
        placeholder: '13800000000',
        layout: 'full',
        badges: resolveConfiguredBadges(config.value, '手机号已配置', '未配置手机号'),
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

  if (
    configKey === 'allowAutoRebind' ||
    configKey === 'autoRebindCooldownMinutes' ||
    configKey === 'autoRebindMaxCount'
  ) {
    return 'rebind'
  }

  if (configKey === 'jwtSecret' || configKey === 'jwtExpiresIn' || configKey === 'bcryptRounds') {
    return 'security'
  }

  if (configKey === 'systemName') {
    return 'branding'
  }

  if (configKey.startsWith('notify')) {
    return 'notification'
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

export function buildSystemConfigPageModel(configs: SystemConfigItem[]): SystemConfigPageModel {
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
