import {
  formatAutoRebindMaxCountLabel,
  formatCooldownMinutesLabel,
} from '@/lib/license-rebind-policy'

export type AdminAuditOperationTypeOption = {
  value: string
  label: string
}

export const adminAuditOperationTypeOptions: AdminAuditOperationTypeOption[] = [
  { value: 'CODE_REBIND_SETTINGS_UPDATED', label: '管理员调整单码策略' },
  { value: 'CODE_FORCE_UNBIND', label: '管理员强制解绑' },
  { value: 'CODE_FORCE_REBIND', label: '管理员强制换绑' },
  { value: 'PROJECT_REBIND_SETTINGS_UPDATED', label: '管理员调整项目策略' },
  { value: 'PROJECT_CREATED', label: '创建项目' },
  { value: 'CODE_BATCH_GENERATED', label: '批量生成激活码' },
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

function formatAutoRebindPolicyLabel(value?: boolean | null) {
  if (value === true) {
    return '允许自助换绑'
  }

  if (value === false) {
    return '禁止自助换绑'
  }

  return '继承上级'
}

export function getAdminOperationTypeLabel(operationType: string) {
  return (
    adminAuditOperationTypeOptions.find((item) => item.value === operationType)?.label ||
    '管理员操作'
  )
}

export function buildAdminOperationDetailSummary(
  operationType: string,
  detailJson?: string | null,
) {
  const detail = parseAdminAuditDetail(detailJson)

  if (!detail) {
    return ''
  }

  if (
    operationType === 'CODE_REBIND_SETTINGS_UPDATED' ||
    operationType === 'PROJECT_REBIND_SETTINGS_UPDATED'
  ) {
    return `次数上限 ${formatAutoRebindMaxCountLabel(
      detail.autoRebindMaxCount ?? null,
    )} / 冷却 ${formatCooldownMinutesLabel(detail.autoRebindCooldownMinutes ?? null)} / ${
      formatAutoRebindPolicyLabel(detail.allowAutoRebind)
    }`
  }

  if (operationType === 'CODE_FORCE_REBIND') {
    return `${detail.fromMachineId || '未绑定'} → ${detail.toMachineId || '未绑定'}`
  }

  if (operationType === 'CODE_FORCE_UNBIND') {
    return `${detail.fromMachineId || '未绑定'} → 未绑定`
  }

  if (operationType === 'PROJECT_CREATED') {
    return detail.name
      ? `项目 ${detail.name}${detail.projectKey ? `（${detail.projectKey}）` : ''}`
      : '已创建项目'
  }

  if (operationType === 'CODE_BATCH_GENERATED') {
    const amount = typeof detail.amount === 'number' ? detail.amount : null
    const licenseMode =
      detail.licenseMode === 'COUNT'
        ? '次数型'
        : detail.licenseMode === 'TIME'
          ? '时间型'
          : null

    if (licenseMode === '次数型') {
      return `${amount ?? '-'} 个${licenseMode}激活码 / 单码 ${detail.totalCount ?? '-'} 次`
    }

    if (licenseMode === '时间型') {
      return `${amount ?? '-'} 个${licenseMode}激活码 / ${detail.validDays ?? '默认'} 天`
    }

    return `${amount ?? '-'} 个激活码`
  }

  return ''
}

export function buildAdminOperationTimelineDescription(entry: AdminAuditLogLike) {
  const baseDescription = entry.reason
    ? `${entry.adminUsername} · ${entry.reason}`
    : entry.adminUsername
  const detailSummary = buildAdminOperationDetailSummary(entry.operationType, entry.detailJson)

  return detailSummary ? `${baseDescription} · ${detailSummary}` : baseDescription
}
