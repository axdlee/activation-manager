import type { ConsumptionQueryFilters } from './consumption-query-params'

export const CONSUMPTION_AUTO_REFRESH_DELAY_MS = 400

export function buildConsumptionAutoRefreshKey(filters: ConsumptionQueryFilters) {
  return JSON.stringify({
    projectKey: filters.projectKey,
    keyword: filters.keyword.trim(),
    createdFrom: filters.createdFrom,
    createdTo: filters.createdTo,
  })
}
