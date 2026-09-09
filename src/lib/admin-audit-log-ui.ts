import {
  formatAutoRebindMaxCountLabel,
  formatCooldownMinutesLabel,
} from '@/lib/license-rebind-policy'
import { getInheritedRebindSettingLabel } from '@/lib/rebind-policy-ui'

export type AuditUiTranslate = (key: string, fallback?: string) => string

export type AdminAuditOperationTypeOption = {
  value: string
  label: string
  labelKey?: string
}

export const adminAuditOperationTypeOptions: AdminAuditOperationTypeOption[] = [
  { value: 'CODE_REBIND_SETTINGS_UPDATED', label: '管理员调整单码策略', labelKey: 'auditui.op.CODE_REBIND_SETTINGS_UPDATED' },
  { value: 'CODE_FORCE_UNBIND', label: '管理员强制解绑', labelKey: 'auditui.op.CODE_FORCE_UNBIND' },
  { value: 'CODE_FORCE_REBIND', label: '管理员强制换绑', labelKey: 'auditui.op.CODE_FORCE_REBIND' },
  { value: 'CODE_DELETED', label: '删除激活码', labelKey: 'auditui.op.CODE_DELETED' },
  { value: 'CODE_CLEANUP_EXPIRED', label: '清理过期激活码', labelKey: 'auditui.op.CODE_CLEANUP_EXPIRED' },
  { value: 'PROJECT_REBIND_SETTINGS_UPDATED', label: '管理员调整项目策略', labelKey: 'auditui.op.PROJECT_REBIND_SETTINGS_UPDATED' },
  { value: 'PROJECT_CREATED', label: '创建项目', labelKey: 'auditui.op.PROJECT_CREATED' },
  { value: 'PROJECT_DELETED', label: '删除项目', labelKey: 'auditui.op.PROJECT_DELETED' },
  { value: 'PROJECT_NAME_UPDATED', label: '修改项目名称', labelKey: 'auditui.op.PROJECT_NAME_UPDATED' },
  { value: 'PROJECT_DESCRIPTION_UPDATED', label: '修改项目描述', labelKey: 'auditui.op.PROJECT_DESCRIPTION_UPDATED' },
  { value: 'PROJECT_STATUS_UPDATED', label: '启停项目', labelKey: 'auditui.op.PROJECT_STATUS_UPDATED' },
  { value: 'CODE_BATCH_GENERATED', label: '批量生成激活码', labelKey: 'auditui.op.CODE_BATCH_GENERATED' },
  { value: 'ADMIN_LOGIN', label: '管理员登录', labelKey: 'auditui.op.ADMIN_LOGIN' },
  { value: 'SYSTEM_CONFIG_UPDATED', label: '更新系统配置', labelKey: 'auditui.op.SYSTEM_CONFIG_UPDATED' },
  { value: 'PASSWORD_CHANGED', label: '管理员修改密码', labelKey: 'auditui.op.PASSWORD_CHANGED' },
]

type AdminAuditLogLike = {
  operationType: string
  adminUsername: string
  reason?: string | null
  detailJson?: string | null
}

type ParsedAdminAuditDetail = {
  allowAutoRebind?: boolean | null
  autoRebindCooldownMinutes?: number | null
  autoRebindMaxCount?: number | null
  fromMachineId?: string | null
  toMachineId?: string | null
  amount?: number
  licenseMode?: string
  validDays?: number | null
  totalCount?: number | null
  name?: string
  projectKey?: string
  description?: string | null
  isEnabled?: boolean | null
}

function parseAdminAuditDetail(detailJson?: string | null): ParsedAdminAuditDetail | null {
  if (!detailJson) {
    return null
  }

  try {
    return JSON.parse(detailJson) as ParsedAdminAuditDetail
  } catch {
    return null
  }
}

function formatAutoRebindPolicyLabel(value?: boolean | null, t?: AuditUiTranslate) {
  if (value === true) {
    return t?.('auditui.policy.allow') ?? '允许自助换绑'
  }

  if (value === false) {
    return t?.('auditui.policy.forbid') ?? '禁止自助换绑'
  }

  return t?.('auditui.policy.inherit') ?? '继承上级策略'
}

function getAuditInheritedRebindLabel(operationType: string) {
  if (operationType === 'CODE_REBIND_SETTINGS_UPDATED') {
    return getInheritedRebindSettingLabel('code')
  }

  if (operationType === 'PROJECT_REBIND_SETTINGS_UPDATED') {
    return getInheritedRebindSettingLabel('project')
  }

  return '继承上级策略'
}

function formatAuditCooldownLabel(value: number | null | undefined, operationType: string) {
  if (value === null || value === undefined) {
    return getAuditInheritedRebindLabel(operationType)
  }

  return formatCooldownMinutesLabel(value)
}

function formatAuditMaxCountLabel(value: number | null | undefined, operationType: string) {
  if (value === null || value === undefined) {
    return getAuditInheritedRebindLabel(operationType)
  }

  return formatAutoRebindMaxCountLabel(value)
}

function formatAuditPolicyLabel(
  value: boolean | null | undefined,
  operationType: string,
  t?: AuditUiTranslate,
) {
  if (value === null || value === undefined) {
    return getAuditInheritedRebindLabel(operationType)
  }

  return formatAutoRebindPolicyLabel(value, t)
}

export function getAdminOperationTypeLabel(operationType: string, t?: AuditUiTranslate) {
  const option = adminAuditOperationTypeOptions.find((item) => item.value === operationType)

  if (!option) {
    return t?.('auditui.op.fallback') ?? '管理员操作'
  }

  if (t && option.labelKey) {
    return t(option.labelKey, option.label)
  }

  return option.label
}

export function buildAdminOperationDetailSummary(
  operationType: string,
  detailJson?: string | null,
  t?: AuditUiTranslate,
) {
  const detail = parseAdminAuditDetail(detailJson)

  if (!detail) {
    return ''
  }

  if (
    operationType === 'CODE_REBIND_SETTINGS_UPDATED' ||
    operationType === 'PROJECT_REBIND_SETTINGS_UPDATED'
  ) {
    return t?.('auditui.detail.countLimit', `次数上限 {max} / 冷却 {cooldown} / 策略 {policy}`)
      ?.replace('{max}', formatAuditMaxCountLabel(detail.autoRebindMaxCount ?? null, operationType))
      .replace('{cooldown}', formatAuditCooldownLabel(detail.autoRebindCooldownMinutes ?? null, operationType))
      .replace('{policy}', formatAuditPolicyLabel(detail.allowAutoRebind, operationType, t)) ??
      `次数上限 ${formatAuditMaxCountLabel(
        detail.autoRebindMaxCount ?? null,
        operationType,
      )} / 冷却 ${formatAuditCooldownLabel(detail.autoRebindCooldownMinutes ?? null, operationType)} / 策略 ${
        formatAuditPolicyLabel(detail.allowAutoRebind, operationType, t)
      }`
  }

  if (operationType === 'CODE_FORCE_REBIND') {
    const from = detail.fromMachineId || t?.('auditui.machine.unbound') || '未绑定'
    const to = detail.toMachineId || t?.('auditui.machine.unbound') || '未绑定'

    return t?.('auditui.detail.forceRebind', '{from} → {to}')
      ?.replace('{from}', from)
      .replace('{to}', to) ?? `${from} → ${to}`
  }

  if (operationType === 'CODE_FORCE_UNBIND') {
    const from = detail.fromMachineId || t?.('auditui.machine.unbound') || '未绑定'
    const to = t?.('auditui.machine.unbound') || '未绑定'

    return t?.('auditui.detail.forceUnbind', '{from} → 未绑定')
      ?.replace('{from}', from)
      .replace('未绑定', to) ?? `${from} → 未绑定`
  }

  if (operationType === 'PROJECT_CREATED') {
    return detail.name
      ? t?.('auditui.detail.projectWithName', '项目 {name}（{key}）')
          ?.replace('{name}', detail.name)
          .replace('{key}', detail.projectKey || '') ??
        `项目 ${detail.name}${detail.projectKey ? `（${detail.projectKey}）` : ''}`
      : t?.('auditui.detail.projectCreated') ?? '已创建项目'
  }

  if (operationType === 'PROJECT_DELETED') {
    return detail.name
      ? t?.('auditui.detail.projectWithName', '项目 {name}（{key}）')
          ?.replace('{name}', detail.name)
          .replace('{key}', detail.projectKey || '') ??
        `项目 ${detail.name}${detail.projectKey ? `（${detail.projectKey}）` : ''}`
      : t?.('auditui.detail.projectDeleted') ?? '已删除项目'
  }

  if (operationType === 'PROJECT_NAME_UPDATED') {
    return t?.('auditui.detail.nameUpdated', '名称 → {value}')?.replace('{value}', detail.name || '-') ??
      `名称 → ${detail.name || '-'}`
  }

  if (operationType === 'PROJECT_DESCRIPTION_UPDATED') {
    return t?.('auditui.detail.descriptionUpdated', '描述 → {value}')?.replace('{value}', detail.description || '-') ??
      `描述 → ${detail.description || '-'}`
  }

  if (operationType === 'PROJECT_STATUS_UPDATED') {
    return detail.isEnabled === true
      ? t?.('auditui.detail.enabled') ?? '已启用'
      : t?.('auditui.detail.disabled') ?? '已停用'
  }

  if (operationType === 'CODE_BATCH_GENERATED') {
    const amount = typeof detail.amount === 'number' ? detail.amount : null
    const licenseMode =
      detail.licenseMode === 'COUNT'
        ? t?.('auditui.license.count') ?? '次数型'
        : detail.licenseMode === 'TIME'
          ? t?.('auditui.license.time') ?? '时间型'
          : null

    if (licenseMode === (t?.('auditui.license.count') ?? '次数型')) {
      return t?.('auditui.detail.batchCount', '{amount} 个{mode}激活码 / 单码 {total} 次')
        ?.replace('{amount}', String(amount ?? '-'))
        .replace('{mode}', licenseMode)
        .replace('{total}', String(detail.totalCount ?? '-')) ??
        `${amount ?? '-'} 个${licenseMode}激活码 / 单码 ${detail.totalCount ?? '-'} 次`
    }

    if (licenseMode === (t?.('auditui.license.time') ?? '时间型')) {
      return t?.('auditui.detail.batchTime', '{amount} 个{mode}激活码 / {days} 天')
        ?.replace('{amount}', String(amount ?? '-'))
        .replace('{mode}', licenseMode)
        .replace('{days}', String(detail.validDays ?? t?.('auditui.detail.defaultDays') ?? '默认')) ??
        `${amount ?? '-'} 个${licenseMode}激活码 / ${detail.validDays ?? '默认'} 天`
    }

    return t?.('auditui.detail.batchDefault', '{amount} 个激活码')?.replace('{amount}', String(amount ?? '-')) ??
      `${amount ?? '-'} 个激活码`
  }

  return ''
}

export function buildAdminOperationTimelineDescription(
  entry: AdminAuditLogLike,
  t?: AuditUiTranslate,
) {
  const baseDescription = entry.reason
    ? `${entry.adminUsername} · ${entry.reason}`
    : entry.adminUsername
  const detailSummary = buildAdminOperationDetailSummary(entry.operationType, entry.detailJson, t)

  return detailSummary ? `${baseDescription} · ${detailSummary}` : baseDescription
}
