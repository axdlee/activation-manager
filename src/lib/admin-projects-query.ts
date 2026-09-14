import type {
  ProjectManagementSortOption,
  ProjectManagementStatusFilter,
} from './project-management-list'

export type AdminProjectsFilterState = {
  keyword: string
  status: ProjectManagementStatusFilter
  sortBy: ProjectManagementSortOption
  page: number
}

export const ADMIN_PROJECTS_DEFAULT_FILTER_STATE: AdminProjectsFilterState = {
  keyword: '',
  status: 'all',
  sortBy: 'createdAtDesc',
  page: 1,
}

const STATUS_VALUES: ProjectManagementStatusFilter[] = ['all', 'enabled', 'disabled']
const SORT_VALUES: ProjectManagementSortOption[] = [
  'createdAtDesc',
  'createdAtAsc',
  'nameAsc',
  'nameDesc',
]

function firstOf(value: string | null | undefined) {
  return typeof value === 'string' ? value : ''
}

/** 把 URL query 解析为筛选状态；未知/非法值一律回退默认，保证旧链接与脏 query 不炸。 */
export function parseAdminProjectsFilterQuery(params: {
  get(key: string): string | null | undefined
}): AdminProjectsFilterState {
  const keyword = firstOf(params.get('keyword')).trim()
  const statusRaw = firstOf(params.get('status')) as ProjectManagementStatusFilter
  const sortRaw = firstOf(params.get('sort')) as ProjectManagementSortOption
  const pageRaw = Number.parseInt(firstOf(params.get('page')), 10)

  return {
    keyword,
    status: STATUS_VALUES.includes(statusRaw) ? statusRaw : 'all',
    sortBy: SORT_VALUES.includes(sortRaw) ? sortRaw : 'createdAtDesc',
    page: Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1,
  }
}

/** 与 parse 对偶：默认值不写入 query，保持 URL 最短可分享。 */
export function buildAdminProjectsFilterQuery(state: AdminProjectsFilterState): string {
  const params = new URLSearchParams()

  if (state.keyword.trim()) {
    params.set('keyword', state.keyword.trim())
  }
  if (state.status !== ADMIN_PROJECTS_DEFAULT_FILTER_STATE.status) {
    params.set('status', state.status)
  }
  if (state.sortBy !== ADMIN_PROJECTS_DEFAULT_FILTER_STATE.sortBy) {
    params.set('sort', state.sortBy)
  }
  if (Number.isFinite(state.page) && state.page > 1) {
    params.set('page', String(state.page))
  }

  return params.toString()
}
