import { getConfigWithDefault } from './config-service'
import {
  AUTO_REBIND_COOLDOWN_MINUTES_MAX,
  AUTO_REBIND_COOLDOWN_MINUTES_MIN,
  AUTO_REBIND_MAX_COUNT_MAX,
  AUTO_REBIND_MAX_COUNT_MIN,
  DEFAULT_ALLOW_AUTO_REBIND,
  DEFAULT_AUTO_REBIND_COOLDOWN_MINUTES,
  DEFAULT_AUTO_REBIND_MAX_COUNT,
} from './license-rebind-policy-shared'

export {
  AUTO_REBIND_COOLDOWN_MINUTES_MAX,
  AUTO_REBIND_COOLDOWN_MINUTES_MIN,
  AUTO_REBIND_MAX_COUNT_MAX,
  AUTO_REBIND_MAX_COUNT_MIN,
  DEFAULT_ALLOW_AUTO_REBIND,
  DEFAULT_AUTO_REBIND_COOLDOWN_MINUTES,
  DEFAULT_AUTO_REBIND_MAX_COUNT,
} from './license-rebind-policy-shared'

export type RebindPolicySource = 'system' | 'project' | 'code'
export type RebindOverrideSelectValue = 'inherit' | 'enabled' | 'disabled'

export type RebindPolicyOverride = {
  allowAutoRebind: boolean | null
  autoRebindCooldownMinutes: number | null
  autoRebindMaxCount: number | null
}

export type RebindPolicyDefaults = {
  allowAutoRebind: boolean
  autoRebindCooldownMinutes: number
  autoRebindMaxCount: number
}

export type RebindPolicySubject = RebindPolicyOverride & {
  project?: Partial<RebindPolicyOverride> | null
}

export type ResolvedRebindPolicy = RebindPolicyDefaults & {
  allowAutoRebindSource: RebindPolicySource
  autoRebindCooldownMinutesSource: RebindPolicySource
  autoRebindMaxCountSource: RebindPolicySource
}

type BindingTimestampCarrier = {
  lastBoundAt?: Date | string | null
  usedAt?: Date | string | null
  createdAt?: Date | string | null
}

function toDate(value: Date | string | null | undefined) {
  if (!value) {
    return null
  }

  return value instanceof Date ? value : new Date(value)
}

export function normalizeNullableBooleanOverride(value: unknown): boolean | null {
  if (value === null || value === undefined || value === '') {
    return null
  }

  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'string') {
    if (value === 'true') {
      return true
    }

    if (value === 'false') {
      return false
    }
  }

  throw new Error('自动换绑开关必须为布尔值、"true"、"false" 或 null')
}

export function normalizeNullableCooldownMinutesOverride(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const normalizedValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : Number.NaN

  if (!Number.isInteger(normalizedValue)) {
    throw new Error('换绑冷却时间必须为整数分钟或 null')
  }

  if (
    normalizedValue < AUTO_REBIND_COOLDOWN_MINUTES_MIN ||
    normalizedValue > AUTO_REBIND_COOLDOWN_MINUTES_MAX
  ) {
    throw new Error(
      `换绑冷却时间必须在 ${AUTO_REBIND_COOLDOWN_MINUTES_MIN} 到 ${AUTO_REBIND_COOLDOWN_MINUTES_MAX} 分钟之间`,
    )
  }

  return normalizedValue
}

export function normalizeNullableMaxCountOverride(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const normalizedValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : Number.NaN

  if (!Number.isInteger(normalizedValue)) {
    throw new Error('自助换绑次数上限必须为整数或 null')
  }

  if (normalizedValue < AUTO_REBIND_MAX_COUNT_MIN || normalizedValue > AUTO_REBIND_MAX_COUNT_MAX) {
    throw new Error(
      `自助换绑次数上限必须在 ${AUTO_REBIND_MAX_COUNT_MIN} 到 ${AUTO_REBIND_MAX_COUNT_MAX} 之间`,
    )
  }

  return normalizedValue
}

export function toRebindOverrideSelectValue(
  value: boolean | null | undefined,
): RebindOverrideSelectValue {
  if (value === true) {
    return 'enabled'
  }

  if (value === false) {
    return 'disabled'
  }

  return 'inherit'
}

export function fromRebindOverrideSelectValue(value: string): boolean | null {
  if (value === 'enabled') {
    return true
  }

  if (value === 'disabled') {
    return false
  }

  return null
}

export function getBindingReferenceTime(carrier: BindingTimestampCarrier) {
  return (
    toDate(carrier.lastBoundAt) ||
    toDate(carrier.usedAt) ||
    toDate(carrier.createdAt) ||
    null
  )
}

export function getNextAllowedAutoRebindAt(
  carrier: BindingTimestampCarrier,
  cooldownMinutes: number,
) {
  const bindingReferenceTime = getBindingReferenceTime(carrier)

  if (!bindingReferenceTime || cooldownMinutes <= 0) {
    return null
  }

  return new Date(bindingReferenceTime.getTime() + cooldownMinutes * 60 * 1000)
}

export function resolveEffectiveRebindPolicy(
  subject: RebindPolicySubject,
  defaults: RebindPolicyDefaults,
): ResolvedRebindPolicy {
  const codeAllowAutoRebind = subject.allowAutoRebind
  const projectAllowAutoRebind = subject.project?.allowAutoRebind ?? null
  const codeCooldown = subject.autoRebindCooldownMinutes
  const projectCooldown = subject.project?.autoRebindCooldownMinutes ?? null
  const codeMaxCount = subject.autoRebindMaxCount
  const projectMaxCount = subject.project?.autoRebindMaxCount ?? null

  return {
    allowAutoRebind:
      codeAllowAutoRebind ??
      projectAllowAutoRebind ??
      defaults.allowAutoRebind,
    allowAutoRebindSource:
      codeAllowAutoRebind !== null && codeAllowAutoRebind !== undefined
        ? 'code'
        : projectAllowAutoRebind !== null && projectAllowAutoRebind !== undefined
          ? 'project'
          : 'system',
    autoRebindCooldownMinutes:
      codeCooldown ??
      projectCooldown ??
      defaults.autoRebindCooldownMinutes,
    autoRebindCooldownMinutesSource:
      codeCooldown !== null && codeCooldown !== undefined
        ? 'code'
        : projectCooldown !== null && projectCooldown !== undefined
          ? 'project'
          : 'system',
    autoRebindMaxCount:
      codeMaxCount ??
      projectMaxCount ??
      defaults.autoRebindMaxCount,
    autoRebindMaxCountSource:
      codeMaxCount !== null && codeMaxCount !== undefined
        ? 'code'
        : projectMaxCount !== null && projectMaxCount !== undefined
          ? 'project'
          : 'system',
  }
}

export async function getSystemRebindPolicyDefaults(): Promise<RebindPolicyDefaults> {
  const [allowAutoRebind, autoRebindCooldownMinutes, autoRebindMaxCount] = await Promise.all([
    getConfigWithDefault('allowAutoRebind'),
    getConfigWithDefault('autoRebindCooldownMinutes'),
    getConfigWithDefault('autoRebindMaxCount'),
  ])

  return {
    allowAutoRebind: Boolean(allowAutoRebind),
    autoRebindCooldownMinutes: Number(autoRebindCooldownMinutes),
    autoRebindMaxCount: Number(autoRebindMaxCount),
  }
}

export function formatCooldownMinutesLabel(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return '继承上级'
  }

  if (value === 0) {
    return '立即可换绑'
  }

  if (value % (24 * 60) === 0) {
    return `${value / (24 * 60)} 天`
  }

  if (value % 60 === 0) {
    return `${value / 60} 小时`
  }

  return `${value} 分钟`
}

export function formatAutoRebindMaxCountLabel(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return '继承上级'
  }

  if (value === 0) {
    return '不限制'
  }

  return `${value} 次`
}
