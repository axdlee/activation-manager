type ConsumptionTrendPointLike = {
  count: number
}

type GetVisibleConsumptionTrendPointsOptions = {
  hideZeroBuckets?: boolean
}

export function getVisibleConsumptionTrendPoints<T extends ConsumptionTrendPointLike>(
  points: T[],
  options: GetVisibleConsumptionTrendPointsOptions = {},
) {
  if (!options.hideZeroBuckets) {
    return {
      points,
      hiddenZeroBucketCount: 0,
    }
  }

  const visiblePoints = points.filter((point) => point.count > 0)

  return {
    points: visiblePoints,
    hiddenZeroBucketCount: points.length - visiblePoints.length,
  }
}
