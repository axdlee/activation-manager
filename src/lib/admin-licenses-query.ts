export type AdminLicensesFilterState = {
  keyword: string
  status: 'all' | 'unused' | 'used' | 'expired' | 'depleted'
  projectKey: string
  cardType: string
  page: number
}

export const ADMIN_LICENSES_DEFAULT_FILTER_STATE: AdminLicensesFilterState = {
  keyword: '',
  status: 'all',
  projectKey: 'all',
  cardType: 'all',
  page: 1,
}

const STATUS_VALUES = ['all', 'unused', 'used', 'expired', 'depleted'] as const

function firstOf(value: string | null | undefined) {
  return typeof value === 'string' ? value : ''
}

/** URL query → 筛选状态；未知/非法值回退默认。 */
export function parseAdminLicensesFilterQuery(params: {
  get(key: string): string | null | undefined
}): AdminLicensesFilterState {
  const statusRaw = firstOf(params.get('status')) as AdminLicensesFilterState['status']
  const pageRaw = Number.parseInt(firstOf(params.get('page')), 10)

  return {
    keyword: firstOf(params.get('keyword')).trim(),
    status: STATUS_VALUES.includes(statusRaw) ? statusRaw : 'all',
    projectKey: firstOf(params.get('projectKey')).trim() || 'all',
    cardType: firstOf(params.get('cardType')).trim() || 'all',
    page: Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1,
  }
}

/** 筛选状态 → URL query；默认值不写入，保持 URL 最短可分享。 */
export function buildAdminLicensesFilterQuery(state: AdminLicensesFilterState): string {
  const params = new URLSearchParams()

  if (state.keyword.trim()) {
    params.set('keyword', state.keyword.trim())
  }
  if (state.status !== ADMIN_LICENSES_DEFAULT_FILTER_STATE.status) {
    params.set('status', state.status)
  }
  if (state.projectKey !== ADMIN_LICENSES_DEFAULT_FILTER_STATE.projectKey) {
    params.set('projectKey', state.projectKey)
  }
  if (state.cardType !== ADMIN_LICENSES_DEFAULT_FILTER_STATE.cardType) {
    params.set('cardType', state.cardType)
  }
  if (Number.isFinite(state.page) && state.page > 1) {
    params.set('page', String(state.page))
  }

  return params.toString()
}
