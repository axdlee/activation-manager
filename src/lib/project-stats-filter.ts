type ProjectStatsLike = {
  projectKey: string
}

export function filterProjectStatsByProjectKey<T extends ProjectStatsLike>(
  projectStats: T[],
  projectKey: string,
) {
  if (projectKey === 'all') {
    return projectStats
  }

  return projectStats.filter((project) => project.projectKey === projectKey)
}
