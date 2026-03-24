type ProjectStatsLike = {
  totalCodes: number
  usedCodes: number
  expiredCodes: number
  activeCodes: number
  countRemainingTotal: number
  countConsumedTotal: number
}

export type ProjectStatsSummary = {
  total: number
  used: number
  expired: number
  active: number
  countRemainingTotal: number
  countConsumedTotal: number
}

export function summarizeProjectStats(projectStats: ProjectStatsLike[]): ProjectStatsSummary {
  return projectStats.reduce(
    (summary, project) => ({
      total: summary.total + project.totalCodes,
      used: summary.used + project.usedCodes,
      expired: summary.expired + project.expiredCodes,
      active: summary.active + project.activeCodes,
      countRemainingTotal: summary.countRemainingTotal + project.countRemainingTotal,
      countConsumedTotal: summary.countConsumedTotal + project.countConsumedTotal,
    }),
    {
      total: 0,
      used: 0,
      expired: 0,
      active: 0,
      countRemainingTotal: 0,
      countConsumedTotal: 0,
    },
  )
}
