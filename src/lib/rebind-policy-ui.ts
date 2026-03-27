import type { RebindPolicySource } from '@/lib/license-rebind-policy'

export type RebindConfigScope = 'system' | 'project' | 'code'

const rebindScopeLabelMap: Record<RebindConfigScope, string> = {
  system: '系统级',
  project: '项目级',
  code: '单码级',
}

export function getRebindScopeLabel(scope: RebindConfigScope) {
  return rebindScopeLabelMap[scope]
}

export function getScopedRebindPolicyLabel(scope: RebindConfigScope) {
  return `${getRebindScopeLabel(scope)}自助换绑策略`
}

export function getScopedRebindCooldownLabel(
  scope: RebindConfigScope,
  includeMinutesUnit: boolean = true,
) {
  return `${getRebindScopeLabel(scope)}换绑冷却时间${includeMinutesUnit ? '（分钟）' : ''}`
}

export function getScopedRebindMaxCountLabel(scope: RebindConfigScope) {
  return `${getRebindScopeLabel(scope)}自助换绑次数上限`
}

export function getInheritedRebindSettingLabel(scope: Exclude<RebindConfigScope, 'system'>) {
  return scope === 'project' ? '继承系统级策略' : '继承项目级策略'
}

export function getInheritedRebindPolicyOptionLabel(scope: Exclude<RebindConfigScope, 'system'>) {
  if (scope === 'project') {
    return '继承系统级策略'
  }

  return '继承项目级策略（未配置时回退系统级）'
}

export function getInheritedRebindPlaceholder(
  scope: Exclude<RebindConfigScope, 'system'>,
  type: 'cooldown' | 'maxCount',
) {
  const inheritLabel = getInheritedRebindSettingLabel(scope)

  if (type === 'cooldown') {
    return `留空则${inheritLabel}`
  }

  return `0 表示不限制；留空则${inheritLabel}`
}

export function getRebindPolicySourceDisplayLabel(source: RebindPolicySource) {
  if (source === 'code') {
    return '单码级配置'
  }

  if (source === 'project') {
    return '项目级配置'
  }

  return '系统级配置'
}
