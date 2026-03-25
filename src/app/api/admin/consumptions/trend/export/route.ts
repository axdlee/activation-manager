import { type NextRequest } from 'next/server'

import { handleExportLicenseConsumptionTrendRequest } from '@/lib/admin-consumption-route-handlers'
import { createProtectedAdminRouteHandler } from '@/lib/admin-route-handler'

export const GET = createProtectedAdminRouteHandler(
  (request: NextRequest) => handleExportLicenseConsumptionTrendRequest(request),
  {
    logLabel: '导出消费趋势失败',
    errorStatus: 400,
    errorMessage: '导出消费趋势失败',
    exposeErrorMessage: true,
  },
)
