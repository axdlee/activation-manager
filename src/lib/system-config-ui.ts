import zhCN from './i18n/zh-CN'

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

/**
 * 文案翻译函数类型：key 为 i18n 词典键，fallback 为缺省文案。
 * 与 useI18n 的 t 签名一致（2 参），client 组件可直接把 useI18n().t 注入进来；
 * 纯函数模块不依赖 React。含 {param} 占位符的文案由本模块统一插值。
 */
export type SystemConfigTranslate = (key: string, fallback?: string) => string

const defaultTranslate: SystemConfigTranslate = (key, fallback) => zhCN[key] ?? fallback ?? key

/** 统一的 {param} 插值：t 返回的模板中 {name} 被 params 对应值替换 */
function interpolateTemplate(template: string, params?: Record<string, string | number>) {
  if (!params) {
    return template
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  )
}

function translateText(
  t: SystemConfigTranslate,
  key: string,
  fallback?: string,
  params?: Record<string, string | number>,
) {
  return interpolateTemplate(t(key, fallback), params)
}

const jwtExpiryOptions: Array<{ labelKey: string; value: string }> = [
  { labelKey: 'sysconfui.option.jwt.1h', value: '1h' },
  { labelKey: 'sysconfui.option.jwt.6h', value: '6h' },
  { labelKey: 'sysconfui.option.jwt.12h', value: '12h' },
  { labelKey: 'sysconfui.option.jwt.24h', value: '24h' },
  { labelKey: 'sysconfui.option.jwt.7d', value: '7d' },
]

const groupMetaMap: Record<Exclude<SystemConfigGroupKey, 'advanced'>, { key: SystemConfigGroupKey; titleKey: string; descriptionKey: string; badgeKey: string }> = {
  access: {
    key: 'access',
    titleKey: 'sysconfui.group.access.title',
    descriptionKey: 'sysconfui.group.access.description',
    badgeKey: 'sysconfui.group.access.badge',
  },
  rebind: {
    key: 'rebind',
    titleKey: 'sysconfui.group.rebind.title',
    descriptionKey: 'sysconfui.group.rebind.description',
    badgeKey: 'sysconfui.group.rebind.badge',
  },
  security: {
    key: 'security',
    titleKey: 'sysconfui.group.security.title',
    descriptionKey: 'sysconfui.group.security.description',
    badgeKey: 'sysconfui.group.security.badge',
  },
  branding: {
    key: 'branding',
    titleKey: 'sysconfui.group.branding.title',
    descriptionKey: 'sysconfui.group.branding.description',
    badgeKey: 'sysconfui.group.branding.badge',
  },
  notification: {
    key: 'notification',
    titleKey: 'sysconfui.group.notification.title',
    descriptionKey: 'sysconfui.group.notification.description',
    badgeKey: 'sysconfui.group.notification.badge',
  },
}

const advancedGroupMeta = {
  key: 'advanced' as SystemConfigGroupKey,
  titleKey: 'sysconfui.group.advanced.title',
  descriptionKey: 'sysconfui.group.advanced.description',
  badgeKey: 'sysconfui.group.advanced.badge',
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

function resolveWhitelistBadges(value: SystemConfigValue, t: SystemConfigTranslate): SystemConfigBadge[] {
  const whitelistEntries = normalizeTokenList(value)

  if (whitelistEntries.length === 0) {
    return [{ label: t('sysconfui.badge.whitelist.notConfigured', '未配置白名单'), tone: 'warning' }]
  }

  return [
    {
      label: translateText(t, 'sysconfui.badge.whitelist.count', '{count} 个地址', { count: whitelistEntries.length }),
      tone: 'info',
    },
  ]
}

function resolveAutoRebindBadges(value: SystemConfigValue, t: SystemConfigTranslate): SystemConfigBadge[] {
  return value === true
    ? [{ label: t('sysconfui.badge.autoRebind.allowed', '允许自助换绑'), tone: 'success' }]
    : [{ label: t('sysconfui.badge.autoRebind.forbidden', '默认禁止'), tone: 'neutral' }]
}

function resolveAutoRebindCooldownBadges(value: SystemConfigValue, t: SystemConfigTranslate): SystemConfigBadge[] {
  const cooldownMinutes = Number(value)

  if (!Number.isFinite(cooldownMinutes)) {
    return []
  }

  if (cooldownMinutes === 0) {
    return [{ label: t('sysconfui.badge.cooldown.none', '无冷却'), tone: 'warning' }]
  }

  if (cooldownMinutes <= 60) {
    return [{ label: t('sysconfui.badge.cooldown.short', '短冷却'), tone: 'info' }]
  }

  if (cooldownMinutes <= 24 * 60) {
    return [{ label: t('sysconfui.badge.recommended', '推荐'), tone: 'success' }]
  }

  return [{ label: t('sysconfui.badge.cooldown.long', '长冷却'), tone: 'neutral' }]
}

function resolveAutoRebindMaxCountBadges(value: SystemConfigValue, t: SystemConfigTranslate): SystemConfigBadge[] {
  const maxCount = Number(value)

  if (!Number.isFinite(maxCount)) {
    return []
  }

  if (maxCount === 0) {
    return [{ label: t('sysconfui.badge.limit.unlimited', '不限制'), tone: 'warning' }]
  }

  if (maxCount <= 3) {
    return [{ label: t('sysconfui.badge.limit.strict', '限制较严'), tone: 'info' }]
  }

  if (maxCount <= 10) {
    return [{ label: t('sysconfui.badge.recommended', '推荐'), tone: 'success' }]
  }

  return [{ label: t('sysconfui.badge.limit.loose', '限制较宽'), tone: 'neutral' }]
}

function resolveJwtExpiresInBadges(value: SystemConfigValue, t: SystemConfigTranslate): SystemConfigBadge[] {
  const normalizedValue = String(value)

  if (normalizedValue === '7d') {
    return [{ label: t('sysconfui.badge.expiry.long', '时长偏长'), tone: 'warning' }]
  }

  if (normalizedValue === '1h') {
    return [{ label: t('sysconfui.badge.expiry.secure', '偏安全'), tone: 'info' }]
  }

  if (normalizedValue === '6h' || normalizedValue === '12h' || normalizedValue === '24h') {
    return [{ label: t('sysconfui.badge.expiry.recommended', '推荐时长'), tone: 'success' }]
  }

  return []
}

function resolveBcryptRoundsBadges(value: SystemConfigValue, t: SystemConfigTranslate): SystemConfigBadge[] {
  const rounds = Number(value)

  if (Number.isNaN(rounds)) {
    return []
  }

  if (rounds < 10) {
    return [{ label: t('sysconfui.badge.strength.low', '强度偏低'), tone: 'warning' }]
  }

  if (rounds <= 12) {
    return [{ label: t('sysconfui.badge.strength.recommended', '推荐强度'), tone: 'success' }]
  }

  return [{ label: t('sysconfui.badge.strength.high', '高强度'), tone: 'info' }]
}

function resolveConfiguredBadges(
  value: SystemConfigValue,
  configuredKey: string,
  configuredFallback: string,
  unconfiguredKey: string,
  unconfiguredFallback: string,
  t: SystemConfigTranslate,
): SystemConfigBadge[] {
  const hasValue = typeof value === 'string' ? Boolean(value.trim()) : Boolean(value)
  return hasValue
    ? [{ label: t(configuredKey, configuredFallback), tone: 'success' }]
    : [{ label: t(unconfiguredKey, unconfiguredFallback), tone: 'warning' }]
}

function resolveSensitiveConfigBadges(config: SystemConfigItem, t: SystemConfigTranslate): SystemConfigBadge[] {
  const badges: SystemConfigBadge[] = [{ label: t('sysconfui.badge.sensitive', '敏感配置'), tone: 'danger' }]

  if (!config.masked) {
    return badges
  }

  badges.push({
    label: config.hasValue ? t('sysconfui.badge.configured', '已配置') : t('sysconfui.badge.notConfigured', '未配置'),
    tone: config.hasValue ? 'success' : 'warning',
  })

  return badges
}

function resolveDisplayItem(config: SystemConfigItem, t: SystemConfigTranslate): SystemConfigDisplayItem {
  switch (config.key) {
    case 'allowedIPs':
      return {
        key: config.key,
        label: t('sysconfui.item.allowedIPs.label', '访问白名单'),
        description: t('sysconfui.item.allowedIPs.description', '仅允许白名单中的 IP 访问管理后台。'),
        hint: t('sysconfui.item.allowedIPs.hint', '每行填写一个 IP 地址；本地开发建议保留 127.0.0.1 与 ::1。'),
        value: config.value,
        inputKind: 'textarea',
        placeholder: '127.0.0.1\n::1',
        layout: 'full',
        badges: resolveWhitelistBadges(config.value, t),
        previewTokens: normalizeTokenList(config.value),
      }
    case 'allowAutoRebind':
      return {
        key: config.key,
        label: t('sysconfui.item.allowAutoRebind.label', '系统级自助换绑策略'),
        description: t('sysconfui.item.allowAutoRebind.description', '作为系统级默认规则，控制激活码在满足条件时是否允许从旧设备自助迁移到新设备。'),
        hint: t('sysconfui.item.allowAutoRebind.hint', '优先级：系统级配置 < 项目级配置 < 单码级配置。建议默认关闭，确实需要跨设备迁移时再开启。'),
        value: config.value,
        inputKind: 'select',
        options: [
          { label: t('sysconfui.item.allowAutoRebind.optionFalse', '默认禁止自助换绑'), value: 'false' },
          { label: t('sysconfui.item.allowAutoRebind.optionTrue', '默认允许自助换绑'), value: 'true' },
        ],
        layout: 'default',
        badges: resolveAutoRebindBadges(config.value, t),
      }
    case 'autoRebindCooldownMinutes':
      return {
        key: config.key,
        label: t('sysconfui.item.autoRebindCooldownMinutes.label', '系统级换绑冷却时间'),
        description: t('sysconfui.item.autoRebindCooldownMinutes.description', '作为系统级默认值，控制同一激活码两次自助换绑之间至少间隔多久。'),
        hint: t('sysconfui.item.autoRebindCooldownMinutes.hint', '单位为分钟；0 表示不设冷却。优先级：系统级配置 < 项目级配置 < 单码级配置。建议至少保留 60 分钟。'),
        value: config.value,
        inputKind: 'number',
        min: 0,
        max: 30 * 24 * 60,
        step: 1,
        layout: 'default',
        badges: resolveAutoRebindCooldownBadges(config.value, t),
      }
    case 'autoRebindMaxCount':
      return {
        key: config.key,
        label: t('sysconfui.item.autoRebindMaxCount.label', '系统级自助换绑次数上限'),
        description: t('sysconfui.item.autoRebindMaxCount.description', '作为系统级默认值，限制单个激活码最多还能自助迁移多少次设备。'),
        hint: t('sysconfui.item.autoRebindMaxCount.hint', '单位为次；0 表示不限制。优先级：系统级配置 < 项目级配置 < 单码级配置。建议结合冷却时间共同使用。'),
        value: config.value,
        inputKind: 'number',
        min: 0,
        max: 9999,
        step: 1,
        layout: 'default',
        badges: resolveAutoRebindMaxCountBadges(config.value, t),
      }
    case 'jwtSecret':
      return {
        key: config.key,
        label: t('sysconfui.item.jwtSecret.label', 'JWT 密钥'),
        description: t('sysconfui.item.jwtSecret.description', '用于签发和校验登录态，修改后现有会话会失效。'),
        hint: config.masked
          ? config.hasValue
            ? t('sysconfui.item.jwtSecret.hint.maskedConfigured', '当前密钥已配置，留空可保持不变；输入新值后会立即覆盖旧密钥。')
            : t('sysconfui.item.jwtSecret.hint.maskedMissing', '当前尚未配置 JWT 密钥，请尽快设置一个足够长的随机字符串。')
          : t('sysconfui.item.jwtSecret.hint.plain', '建议使用足够长的随机字符串，并妥善保管。'),
        value: config.value,
        inputKind: 'password',
        sensitive: true,
        masked: config.masked,
        hasValue: config.hasValue,
        placeholder: config.hasValue
          ? t('sysconfui.item.jwtSecret.placeholderConfigured', '如需更新，请输入新的 JWT 密钥')
          : t('sysconfui.item.jwtSecret.placeholderNew', '请输入新的 JWT 密钥'),
        layout: 'full',
        badges: resolveSensitiveConfigBadges(config, t),
      }
    case 'jwtExpiresIn':
      return {
        key: config.key,
        label: t('sysconfui.item.jwtExpiresIn.label', '登录有效期'),
        description: t('sysconfui.item.jwtExpiresIn.description', '控制管理员登录态保持时间。'),
        hint: t('sysconfui.item.jwtExpiresIn.hint', '时间越长越方便，越短越安全；推荐在 6 小时到 24 小时之间。'),
        value: config.value,
        inputKind: 'select',
        options: jwtExpiryOptions.map((option) => ({
          label: translateText(t, option.labelKey, option.value),
          value: option.value,
        })),
        layout: 'default',
        badges: resolveJwtExpiresInBadges(config.value, t),
      }
    case 'bcryptRounds':
      return {
        key: config.key,
        label: t('sysconfui.item.bcryptRounds.label', '密码哈希强度'),
        description: t('sysconfui.item.bcryptRounds.description', '用于管理员密码的 bcrypt 成本轮数。'),
        hint: t('sysconfui.item.bcryptRounds.hint', '推荐 10-12；越高越安全，但登录和修改密码也会更慢。'),
        value: config.value,
        inputKind: 'number',
        layout: 'default',
        badges: resolveBcryptRoundsBadges(config.value, t),
      }
    case 'systemName':
      return {
        key: config.key,
        label: t('sysconfui.item.systemName.label', '系统名称'),
        description: t('sysconfui.item.systemName.description', '后台、登录页等区域的系统展示名称。'),
        hint: t('sysconfui.item.systemName.hint', '适合设置为团队内部熟悉的品牌或产品名称。'),
        value: config.value,
        inputKind: 'text',
        placeholder: t('sysconfui.item.systemName.placeholder', '例如：浏览器插件授权中心'),
        layout: 'full',
        badges: [{ label: t('sysconfui.badge.branding', '品牌识别'), tone: 'neutral' }],
      }
    case 'shopEnabled':
      return {
        key: config.key,
        label: t('sysconfui.item.shopEnabled.label', '启用购买中心'),
        description: t('sysconfui.item.shopEnabled.description', '是否对外开放购买中心：商品展示、下单、支付与自动发卡。'),
        hint: t('sysconfui.item.shopEnabled.hint', '关闭后 /shop 购买页与下单 API 将不可用；后台购买中心管理仍可访问（用于维护商品与配置）。'),
        value: config.value,
        inputKind: 'select',
        options: [
          { label: t('sysconfui.item.shopEnabled.optionTrue', '启用购买中心'), value: 'true' },
          { label: t('sysconfui.item.shopEnabled.optionFalse', '停用购买中心'), value: 'false' },
        ],
        layout: 'default',
        badges:
          config.value === true
            ? [{ label: t('sysconfui.badge.enabled', '已启用'), tone: 'success' }]
            : [{ label: t('sysconfui.badge.disabled', '已停用'), tone: 'warning' }],
      }
    case 'expiryWebhookUrl':
      return {
        key: config.key,
        label: t('sysconfui.item.expiryWebhookUrl.label', '到期通知接口（旧）'),
        description: t('sysconfui.item.expiryWebhookUrl.description', '激活码到期或次数耗尽时的旧版通知入口；已配置「通用通知 Webhook」时此地址不再发送。'),
        hint: t('sysconfui.item.expiryWebhookUrl.hint', '建议改用「通用通知 Webhook」统一接收所有事件。此地址仅在未配置通用 Webhook 时用于到期事件，且保持原有扁平 payload 格式。'),
        value: config.value,
        inputKind: 'text',
        placeholder: 'https://example.com/hooks/license-expiry',
        layout: 'full',
        badges:
          typeof config.value === 'string' && config.value.trim()
            ? [{ label: t('sysconfui.badge.notify.enabled', '通知已启用'), tone: 'success' }]
            : [{ label: t('sysconfui.badge.notEnabled', '未启用'), tone: 'warning' }],
      }
    case 'allowDeviceBinding':
      return {
        key: config.key,
        label: t('sysconfui.item.allowDeviceBinding.label', '启用设备绑定'),
        description: t('sysconfui.item.allowDeviceBinding.description', '激活码是否绑定到首次激活的设备。关闭后，激活码不再记录绑定机器。'),
        hint: t('sysconfui.item.allowDeviceBinding.hint', '默认开启。关闭后同一激活码可在任意设备使用，适合无需设备锁定的授权场景。'),
        value: config.value,
        inputKind: 'select',
        options: [
          { label: t('sysconfui.item.allowDeviceBinding.optionTrue', '启用设备绑定'), value: 'true' },
          { label: t('sysconfui.item.allowDeviceBinding.optionFalse', '不绑定设备'), value: 'false' },
        ],
        layout: 'default',
        badges:
          config.value === true
            ? [{ label: t('sysconfui.badge.enabled', '已启用'), tone: 'success' }]
            : [{ label: t('sysconfui.badge.notEnabled', '未启用'), tone: 'warning' }],
      }
    case 'licenseResponseSecret':
      return {
        key: config.key,
        label: t('sysconfui.item.licenseResponseSecret.label', '响应签名密钥'),
        description: t('sysconfui.item.licenseResponseSecret.description', '为 License API 响应附加 HMAC-SHA256 签名，客户端 SDK 配置同一密钥后可验签防篡改。'),
        hint: t('sysconfui.item.licenseResponseSecret.hint', '留空表示不签名（向后兼容）；配置后 SDK 需同步配置 responseSecret，否则验签失败。建议使用足够长的随机字符串。'),
        value: config.value,
        inputKind: 'password',
        sensitive: true,
        masked: config.masked,
        hasValue: config.hasValue,
        placeholder: config.hasValue
          ? t('sysconfui.item.licenseResponseSecret.placeholderConfigured', '如需更新，请输入新的签名密钥')
          : t('sysconfui.item.licenseResponseSecret.placeholderNew', '请输入新的签名密钥'),
        layout: 'full',
        badges:
          typeof config.value === 'string' && config.value.trim()
            ? [{ label: t('sysconfui.badge.signature.enabled', '签名已启用'), tone: 'success' }]
            : [{ label: t('sysconfui.badge.notEnabled', '未启用'), tone: 'warning' }],
      }
    case 'notifyWebhookUrl':
      return {
        key: config.key,
        label: t('sysconfui.item.notifyWebhookUrl.label', '通用通知 Webhook'),
        description: t('sysconfui.item.notifyWebhookUrl.description', '关键业务事件（激活码到期、订单发卡、超时取消）发生时，向该地址 POST JSON 通知。'),
        hint: t('sysconfui.item.notifyWebhookUrl.hint', '留空表示不通知。配置后激活码到期事件优先走此地址（不再发送下方旧「到期通知接口」）。接口需返回 2xx 视为成功。'),
        value: config.value,
        inputKind: 'text',
        placeholder: 'https://example.com/hooks/activation-manager',
        layout: 'full',
        badges: resolveConfiguredBadges(
          config.value,
          'sysconfui.badge.notify.enabled',
          '通知已启用',
          'sysconfui.badge.notEnabled',
          '未启用',
          t,
        ),
      }
    case 'notifyEmailSmtpHost':
      return {
        key: config.key,
        label: t('sysconfui.item.notifyEmailSmtpHost.label', '邮件通知 SMTP 服务器'),
        description: t('sysconfui.item.notifyEmailSmtpHost.description', '配置后到期、发卡等事件会同时发送邮件通知到下方收件人。'),
        hint: t('sysconfui.item.notifyEmailSmtpHost.hint', '例如 smtp.qq.com、smtp.163.com；留空表示不启用邮件通知。邮箱需开启 SMTP 并使用授权码登录。'),
        value: config.value,
        inputKind: 'text',
        placeholder: 'smtp.example.com',
        layout: 'default',
        badges: resolveConfiguredBadges(
          config.value,
          'sysconfui.badge.email.enabled',
          '邮件通知已启用',
          'sysconfui.badge.email.disabled',
          '邮件通知未启用',
          t,
        ),
      }
    case 'notifyEmailSmtpPort':
      return {
        key: config.key,
        label: t('sysconfui.item.notifyEmailSmtpPort.label', '邮件通知 SMTP 端口'),
        description: t('sysconfui.item.notifyEmailSmtpPort.description', 'SMTP 服务端口；465 使用 SSL 直连，其他端口按 STARTTLS/明文处理。'),
        hint: t('sysconfui.item.notifyEmailSmtpPort.hint', '常用端口：465（SSL）或 587/25（STARTTLS）。'),
        value: config.value,
        inputKind: 'number',
        min: 1,
        max: 65535,
        step: 1,
        layout: 'default',
        badges: [{ label: t('sysconfui.badge.smtpPort.default', '默认 465'), tone: 'neutral' }],
      }
    case 'notifyEmailSmtpUser':
      return {
        key: config.key,
        label: t('sysconfui.item.notifyEmailSmtpUser.label', '邮件通知 SMTP 用户名'),
        description: t('sysconfui.item.notifyEmailSmtpUser.description', 'SMTP 登录用户名，通常为发件邮箱地址。'),
        hint: t('sysconfui.item.notifyEmailSmtpUser.hint', '与密码/授权码同时填写才启用 SMTP 认证；使用无需认证的内网 SMTP 可留空。'),
        value: config.value,
        inputKind: 'text',
        placeholder: 'notify@example.com',
        layout: 'default',
        badges: [],
      }
    case 'notifyEmailSmtpPass':
      return {
        key: config.key,
        label: t('sysconfui.item.notifyEmailSmtpPass.label', '邮件通知 SMTP 密码/授权码'),
        description: t('sysconfui.item.notifyEmailSmtpPass.description', 'SMTP 登录密码或邮箱服务商提供的授权码。'),
        hint: config.masked
          ? config.hasValue
            ? t('sysconfui.item.notifyEmailSmtpPass.hint.maskedConfigured', '当前授权码已配置，留空可保持不变；输入新值后会立即覆盖。')
            : t('sysconfui.item.notifyEmailSmtpPass.hint.maskedMissing', '尚未配置 SMTP 授权码，请从邮箱服务商设置中生成后填写。')
          : t('sysconfui.item.notifyEmailSmtpPass.hint.plain', '建议使用授权码而非邮箱登录密码，并妥善保管。'),
        value: config.value,
        inputKind: 'password',
        sensitive: true,
        masked: config.masked,
        hasValue: config.hasValue,
        placeholder: config.hasValue
          ? t('sysconfui.item.notifyEmailSmtpPass.placeholderConfigured', '如需更新，请输入新的授权码')
          : t('sysconfui.item.notifyEmailSmtpPass.placeholderNew', '请输入 SMTP 密码/授权码'),
        layout: 'full',
        badges: resolveSensitiveConfigBadges(config, t),
      }
    case 'notifyEmailFrom':
      return {
        key: config.key,
        label: t('sysconfui.item.notifyEmailFrom.label', '邮件通知发件人'),
        description: t('sysconfui.item.notifyEmailFrom.description', '通知邮件展示的发件人地址。'),
        hint: t('sysconfui.item.notifyEmailFrom.hint', '留空时默认使用 SMTP 用户名作为发件人。'),
        value: config.value,
        inputKind: 'text',
        placeholder: 'notify@example.com',
        layout: 'default',
        badges: [],
      }
    case 'notifyEmailTo':
      return {
        key: config.key,
        label: t('sysconfui.item.notifyEmailTo.label', '邮件通知收件人'),
        description: t('sysconfui.item.notifyEmailTo.description', '接收通知邮件的管理员邮箱，可填写多个。'),
        hint: t('sysconfui.item.notifyEmailTo.hint', '多个邮箱用逗号或换行分隔；未填写时邮件通知不启用。'),
        value: config.value,
        inputKind: 'textarea',
        placeholder: 'admin@example.com',
        layout: 'full',
        badges: resolveConfiguredBadges(
          config.value,
          'sysconfui.badge.recipients.configured',
          '收件人已配置',
          'sysconfui.badge.recipients.missing',
          '未配置收件人',
          t,
        ),
      }
    case 'notifySmsApiUrl':
      return {
        key: config.key,
        label: t('sysconfui.item.notifySmsApiUrl.label', '短信通知网关地址'),
        description: t('sysconfui.item.notifySmsApiUrl.description', '通用 HTTP 短信网关；配置后关键事件会以短信形式发送到下方手机号。'),
        hint: t('sysconfui.item.notifySmsApiUrl.hint', '兼容提交 JSON 的短信服务商（阿里云短信助手、短信宝等 HTTP 网关）；留空表示不启用短信通知。'),
        value: config.value,
        inputKind: 'text',
        placeholder: 'https://sms.example.com/api/send',
        layout: 'full',
        badges: resolveConfiguredBadges(
          config.value,
          'sysconfui.badge.sms.enabled',
          '短信通知已启用',
          'sysconfui.badge.sms.disabled',
          '短信通知未启用',
          t,
        ),
      }
    case 'notifySmsApiBody':
      return {
        key: config.key,
        label: t('sysconfui.item.notifySmsApiBody.label', '短信请求体模板'),
        description: t('sysconfui.item.notifySmsApiBody.description', '发送短信时的 POST 请求体模板，占位符 {phone} 与 {content} 会被替换。'),
        hint: t('sysconfui.item.notifySmsApiBody.hint', '默认模板：{"phone":"{phone}","content":"{content}"}。按短信服务商接口文档调整字段名。'),
        value: config.value,
        inputKind: 'textarea',
        placeholder: '{"phone":"{phone}","content":"{content}"}',
        layout: 'full',
        badges: [
          { label: t('sysconfui.badge.smsBody.placeholders', '支持 {phone} {content} 占位符'), tone: 'neutral' },
        ],
      }
    case 'notifySmsPhones':
      return {
        key: config.key,
        label: t('sysconfui.item.notifySmsPhones.label', '短信接收手机号'),
        description: t('sysconfui.item.notifySmsPhones.description', '接收通知短信的管理员手机号，可填写多个。'),
        hint: t('sysconfui.item.notifySmsPhones.hint', '多个手机号用逗号或换行分隔；未填写时短信通知不启用。'),
        value: config.value,
        inputKind: 'textarea',
        placeholder: '13800000000',
        layout: 'full',
        badges: resolveConfiguredBadges(
          config.value,
          'sysconfui.badge.phones.configured',
          '手机号已配置',
          'sysconfui.badge.phones.missing',
          '未配置手机号',
          t,
        ),
      }
    default:
      return {
        key: config.key,
        label: humanizeConfigKey(config.key),
        description: config.description || t('sysconfui.item.default.description', '自定义系统配置项'),
        hint: t('sysconfui.item.default.hint', '当前为未归类的扩展配置，将按原始值直接保存。'),
        value: config.value,
        inputKind: 'text',
        placeholder: translateText(t, 'sysconfui.item.default.placeholder', '请输入{label}', {
          label: config.description || config.key,
        }),
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

function formatWhitelistValue(value: SystemConfigValue, t: SystemConfigTranslate) {
  if (Array.isArray(value)) {
    return translateText(t, 'sysconfui.badge.whitelist.count', '{count} 个地址', { count: value.length })
  }

  return value
    ? t('sysconfui.badge.configured', '已配置')
    : t('sysconfui.badge.notConfigured', '未配置')
}

function formatRoundsValue(value: SystemConfigValue, t: SystemConfigTranslate) {
  return translateText(t, 'sysconfui.summary.roundsValue', '{rounds} 轮', { rounds: String(value) })
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

/**
 * 构建系统配置页展示模型。
 *
 * @param configs 系统配置列表
 * @param translate 可选的文案翻译函数；client 组件应传入 useI18n().t。
 *   缺省时回退到 zh-CN 词典直查（再回退到 fallback 中文原文），
 *   保证纯函数调用方不传 t 时渲染行为与迁移前一致。
 */
export function buildSystemConfigPageModel(
  configs: SystemConfigItem[],
  translate?: SystemConfigTranslate,
): SystemConfigPageModel {
  const t = translate ?? defaultTranslate
  const groupedItems = new Map<SystemConfigGroupKey, SystemConfigDisplayItem[]>()

  configs.forEach((config) => {
    const groupKey = resolveGroupKey(config.key)
    const displayItem = resolveDisplayItem(config, t)
    const items = groupedItems.get(groupKey) || []
    groupedItems.set(groupKey, [...items, displayItem])
  })

  const groups: SystemConfigGroup[] = [
    ...Object.values(groupMetaMap)
      .map((group) => ({
        key: group.key,
        title: t(group.titleKey),
        description: t(group.descriptionKey),
        badge: t(group.badgeKey),
        items: sortGroupItems(group.key, groupedItems.get(group.key) || []),
      }))
      .filter((group) => group.items.length > 0),
    ...(groupedItems.get('advanced')?.length
      ? [
          {
            key: advancedGroupMeta.key,
            title: t(advancedGroupMeta.titleKey),
            description: t(advancedGroupMeta.descriptionKey),
            badge: t(advancedGroupMeta.badgeKey),
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
      label: t('sysconfui.summary.configs.label', '配置项'),
      value: String(configs.length),
      description: t('sysconfui.summary.configs.description', '当前已加载的系统配置总数'),
    },
    {
      label: t('sysconfui.summary.whitelist.label', '访问白名单'),
      value: formatWhitelistValue(allowedIPs, t),
      description: t('sysconfui.summary.whitelist.description', '后台访问来源将按白名单限制'),
    },
    {
      label: t('sysconfui.summary.session.label', '登录会话'),
      value: String(jwtExpiresIn),
      description: t('sysconfui.summary.session.description', 'JWT 登录态有效期'),
    },
    {
      label: t('sysconfui.summary.strength.label', '密码强度'),
      value: formatRoundsValue(bcryptRounds, t),
      description: t('sysconfui.summary.strength.description', 'bcrypt 哈希成本'),
    },
  ]

  return {
    groups,
    summaryCards,
  }
}
