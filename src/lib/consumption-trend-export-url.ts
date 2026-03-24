type ConsumptionTrendGranularity = 'day' | 'week' | 'month'

type ConsumptionTrendExportFilters = {
  days: number
  granularity: ConsumptionTrendGranularity
  projectKey: string
  compareProjectKey: string
  hideZeroBuckets: boolean
}

export function buildConsumptionTrendExportUrl(filters: ConsumptionTrendExportFilters) {
  const params = new URLSearchParams({
    days: String(filters.days),
    granularity: filters.granularity,
  })

  if (filters.projectKey !== 'all') {
    params.set('projectKey', filters.projectKey)
  }

  const shouldCompare =
    filters.compareProjectKey !== 'none' &&
    (filters.projectKey === 'all' || filters.compareProjectKey !== filters.projectKey)

  if (shouldCompare) {
    params.set('compareProjectKey', filters.compareProjectKey)
  }

  if (filters.hideZeroBuckets) {
    params.set('hideZeroBuckets', 'true')
  }

  return `/api/admin/consumptions/trend/export?${params.toString()}`
}
