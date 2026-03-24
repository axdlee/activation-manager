type ProjectStatsLike = {
  name: string
  projectKey: string
  countRemainingTotal: number
  countConsumedTotal: number
}

type PeakConsumptionProject = {
  name: string
  projectKey: string
  countConsumedTotal: number
}

export type ProjectStatsInsights = {
  totalCountCapacity: number
  countUsageRate: number
  peakConsumptionProject: PeakConsumptionProject | null
}

export function buildProjectStatsInsights(projectStats: ProjectStatsLike[]): ProjectStatsInsights {
  const totalCountRemaining = projectStats.reduce(
    (sum, project) => sum + project.countRemainingTotal,
    0,
  )
  const totalCountConsumed = projectStats.reduce(
    (sum, project) => sum + project.countConsumedTotal,
    0,
  )
  const totalCountCapacity = totalCountRemaining + totalCountConsumed
  const peakConsumptionProject = projectStats.reduce<PeakConsumptionProject | null>((peak, project) => {
    if (project.countConsumedTotal <= 0) {
      return peak
    }

    if (!peak || project.countConsumedTotal > peak.countConsumedTotal) {
      return {
        name: project.name,
        projectKey: project.projectKey,
        countConsumedTotal: project.countConsumedTotal,
      }
    }

    return peak
  }, null)

  return {
    totalCountCapacity,
    countUsageRate:
      totalCountCapacity > 0
        ? Number(((totalCountConsumed / totalCountCapacity) * 100).toFixed(1))
        : 0,
    peakConsumptionProject,
  }
}
