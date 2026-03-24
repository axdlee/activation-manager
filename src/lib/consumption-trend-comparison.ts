type ConsumptionTrendPointLike = {
  date: string
  label: string
  count: number
}

type BuildConsumptionTrendComparisonSeriesOptions = {
  hideZeroBuckets?: boolean
}

type ConsumptionTrendComparisonSeriesPoint = {
  date: string
  label: string
  primaryCount: number
  secondaryCount: number
}

export function buildConsumptionTrendComparisonSeries<
  TPrimary extends ConsumptionTrendPointLike,
  TSecondary extends ConsumptionTrendPointLike,
>(
  primaryPoints: TPrimary[],
  secondaryPoints: TSecondary[],
  options: BuildConsumptionTrendComparisonSeriesOptions = {},
) {
  const secondaryPointMap = new Map(
    secondaryPoints.map((point) => [point.date, point]),
  )

  const points = primaryPoints.map<ConsumptionTrendComparisonSeriesPoint>((point) => ({
    date: point.date,
    label: point.label,
    primaryCount: point.count,
    secondaryCount: secondaryPointMap.get(point.date)?.count ?? 0,
  }))

  const visiblePoints = options.hideZeroBuckets
    ? points.filter((point) => point.primaryCount > 0 || point.secondaryCount > 0)
    : points

  return {
    points: visiblePoints,
    hiddenZeroBucketCount: points.length - visiblePoints.length,
    maxCount: visiblePoints.reduce(
      (max, point) => Math.max(max, point.primaryCount, point.secondaryCount),
      0,
    ),
  }
}
