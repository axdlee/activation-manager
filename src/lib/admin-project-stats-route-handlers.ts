import type { PrismaClient } from '@prisma/client'

import { prisma } from './db'
import { listProjectStats } from './license-service'
import { buildProjectStatsCsv } from './project-stats-export'
import { filterProjectStatsByProjectKey } from './project-stats-filter'

export function readProjectStatsFilters(request: Request) {
  const requestUrl = new URL(request.url)

  return {
    projectKey: requestUrl.searchParams.get('projectKey') || 'all',
  }
}

export async function handleExportProjectStatsRequest(
  request: Request,
  client: PrismaClient = prisma,
) {
  const { projectKey } = readProjectStatsFilters(request)
  const projectStats = await listProjectStats(client)
  const filteredProjectStats = filterProjectStatsByProjectKey(projectStats, projectKey)
  const filename = `project_stats_${new Date().toISOString().slice(0, 10)}.csv`

  return new Response(buildProjectStatsCsv(filteredProjectStats), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
