export type ConsumptionsQueryState = {
  keyword: string
  projectKey: string
  createdFrom: string
  createdTo: string
  page: number
}

export type AuditQueryState = ConsumptionsQueryState & {
  operationType: string
}

export const CONSUMPTIONS_DEFAULT_QUERY: ConsumptionsQueryState = {
  keyword: '',
  projectKey: 'all',
  createdFrom: '',
  createdTo: '',
  page: 1,
}

export const AUDIT_DEFAULT_QUERY: AuditQueryState = {
  ...CONSUMPTIONS_DEFAULT_QUERY,
  operationType: 'all',
}

function firstOf(value: string | null | undefined) {
  return typeof value === 'string' ? value : ''
}

function parsePage(value: string | null | undefined) {
  const page = Number.parseInt(firstOf(value), 10)
  return Number.isFinite(page) && page >= 1 ? page : 1
}

function appendRange(params: URLSearchParams, state: { keyword: string; projectKey: string; createdFrom: string; createdTo: string; page: number }) {
  if (state.keyword.trim()) params.set('keyword', state.keyword.trim())
  if (state.projectKey !== 'all') params.set('project', state.projectKey)
  if (state.createdFrom) params.set('from', state.createdFrom)
  if (state.createdTo) params.set('to', state.createdTo)
  if (Number.isFinite(state.page) && state.page > 1) params.set('page', String(state.page))
}

/** 消费日志 URL query：默认值不写入，保持可分享的最短形态。 */
export function buildConsumptionsQuery(state: ConsumptionsQueryState): string {
  const params = new URLSearchParams()
  appendRange(params, state)
  return params.toString()
}

export function parseConsumptionsQuery(params: {
  get(key: string): string | null | undefined
}): ConsumptionsQueryState {
  return {
    keyword: firstOf(params.get('keyword')).trim(),
    projectKey: firstOf(params.get('project')) || 'all',
    createdFrom: firstOf(params.get('from')),
    createdTo: firstOf(params.get('to')),
    page: parsePage(params.get('page')),
  }
}

/** 审计中心 URL query。 */
export function buildAuditQuery(state: AuditQueryState): string {
  const params = new URLSearchParams()
  appendRange(params, state)
  if (state.operationType !== 'all') params.set('operation', state.operationType)
  return params.toString()
}

export function parseAuditQuery(params: {
  get(key: string): string | null | undefined
}): AuditQueryState {
  return {
    ...parseConsumptionsQuery(params),
    operationType: firstOf(params.get('operation')) || 'all',
  }
}
