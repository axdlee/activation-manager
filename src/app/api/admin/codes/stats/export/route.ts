import { type NextRequest } from 'next/server'

import { handleExportProjectStatsRequest } from '@/lib/admin-project-stats-route-handlers'
import { createProtectedAdminRouteHandler } from '@/lib/admin-route-handler'

export const GET = createProtectedAdminRouteHandler(
  (request: NextRequest) => handleExportProjectStatsRequest(request),
  {
    logLabel: '导出项目统计失败',
    errorStatus: 400,
    errorMessage: '导出项目统计失败',
    exposeErrorMessage: true,
  },
)
