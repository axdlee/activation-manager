export type ConsumptionQueryFilters = {
  projectKey: string
  keyword: string
  createdFrom: string
  createdTo: string
}

export function buildConsumptionQueryParams(filters: ConsumptionQueryFilters) {
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

  return params
}
