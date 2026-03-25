export type ConsumptionQueryFilters = {
  projectKey: string
  keyword: string
  createdFrom: string
  createdTo: string
}

export type ConsumptionQueryPagination = {
  page?: number
  pageSize?: number
}

export function buildConsumptionQueryParams(
  filters: ConsumptionQueryFilters,
  pagination: ConsumptionQueryPagination = {},
) {
  const params = new URLSearchParams()
  const keyword = filters.keyword.trim()

  if (filters.projectKey !== 'all') {
    params.set('projectKey', filters.projectKey)
  }

  if (keyword) {
    params.set('keyword', keyword)
  }

  if (filters.createdFrom) {
    params.set('createdFrom', new Date(filters.createdFrom).toISOString())
  }

  if (filters.createdTo) {
    params.set('createdTo', new Date(filters.createdTo).toISOString())
  }

  if (typeof pagination.page === 'number') {
    params.set('page', String(pagination.page))
  }

  if (typeof pagination.pageSize === 'number') {
    params.set('pageSize', String(pagination.pageSize))
  }

  return params
}
