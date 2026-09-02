import { useCallback, useState } from 'react'

import type { ConsumptionTrend } from './dashboard-page-types'

export type ConsumptionTrendGranularity = 'day' | 'week' | 'month'
export type ConsumptionTrendDays = 7 | 30

export type UseConsumptionTrendOptions = {
  defaultDays?: ConsumptionTrendDays
  defaultGranularity?: ConsumptionTrendGranularity
}

export function useConsumptionTrend(options: UseConsumptionTrendOptions = {}) {
  const [trend, setTrend] = useState<ConsumptionTrend | null>(null)
  const [comparisonTrend, setComparisonTrend] = useState<ConsumptionTrend | null>(null)
  const [days, setDays] = useState<ConsumptionTrendDays>(options.defaultDays ?? 7)
  const [granularity, setGranularity] = useState<ConsumptionTrendGranularity>(
    options.defaultGranularity ?? 'day',
  )
  const [compareProjectKey, setCompareProjectKey] = useState<'none' | string>('none')
  const [hideZeroBuckets, setHideZeroBuckets] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [compareError, setCompareError] = useState<string | null>(null)

  const fetchTrend = useCallback(
    async (projectKey: string) => {
      setLoading(true)
      setError(null)
      setCompareError(null)

      try {
        const primaryParams = new URLSearchParams({
          days: String(days),
          granularity,
        })

        if (projectKey !== 'all') {
          primaryParams.set('projectKey', projectKey)
        }

        const shouldCompareTrend =
          compareProjectKey !== 'none' &&
          (projectKey === 'all' || compareProjectKey !== projectKey)

        const compareParams = new URLSearchParams({
          days: String(days),
          granularity,
        })

        if (shouldCompareTrend) {
          compareParams.set('projectKey', compareProjectKey)
        }

        const [primaryResult, compareResult] = await Promise.allSettled([
          fetch(`/api/admin/consumptions/trend?${primaryParams.toString()}`).then((response) =>
            response.json(),
          ),
          shouldCompareTrend
            ? fetch(`/api/admin/consumptions/trend?${compareParams.toString()}`).then((response) =>
                response.json(),
              )
            : Promise.resolve(null),
        ])

        if (primaryResult.status !== 'fulfilled') {
          throw primaryResult.reason
        }

        const data = primaryResult.value

        if (data.success) {
          setTrend(data.trend)
          setError(null)
        } else {
          setTrend(null)
          setComparisonTrend(null)
          setError(data.message || '获取消费趋势失败')
          return
        }

        if (!shouldCompareTrend) {
          setComparisonTrend(null)
          setCompareError(null)
        } else if (compareResult.status === 'fulfilled' && compareResult.value?.success) {
          setComparisonTrend(compareResult.value.trend)
          setCompareError(null)
        } else {
          setComparisonTrend(null)
          setCompareError(
            compareResult.status === 'fulfilled'
              ? compareResult.value?.message || '获取对比项目趋势失败'
              : '获取对比项目趋势失败',
          )
        }
      } catch (fetchError) {
        setTrend(null)
        setComparisonTrend(null)
        setError('获取消费趋势失败')
        console.error('获取消费趋势失败:', fetchError)
      } finally {
        setLoading(false)
      }
    },
    [days, granularity, compareProjectKey],
  )

  return {
    trend,
    comparisonTrend,
    days,
    setDays,
    granularity,
    setGranularity,
    compareProjectKey,
    setCompareProjectKey,
    hideZeroBuckets,
    setHideZeroBuckets,
    loading,
    error,
    compareError,
    fetchTrend,
  }
}