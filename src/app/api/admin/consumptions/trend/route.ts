import { type NextRequest } from 'next/server'

import { handleListLicenseConsumptionTrendRequest } from '@/lib/admin-consumption-route-handlers'
import { createProtectedAdminRouteHandler } from '@/lib/admin-route-handler'

export const GET = createProtectedAdminRouteHandler(
  (request: NextRequest) => handleListLicenseConsumptionTrendRequest(request),
  {
    logLabel: '获取消费趋势失败',
    errorStatus: 400,
    errorMessage: '获取消费趋势失败',
    exposeErrorMessage: true,
  },
)
