import { type NextRequest } from 'next/server'

import { handleExportLicenseConsumptionsRequest } from '@/lib/admin-consumption-route-handlers'
import { createProtectedAdminRouteHandler } from '@/lib/admin-route-handler'

export const GET = createProtectedAdminRouteHandler(
  (request: NextRequest) => handleExportLicenseConsumptionsRequest(request),
  {
    logLabel: '导出消费日志失败',
    errorStatus: 400,
    errorMessage: '导出消费日志失败',
    exposeErrorMessage: true,
  },
)
