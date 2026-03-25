import { type NextRequest } from 'next/server'

import { handleListLicenseConsumptionsRequest } from '@/lib/admin-consumption-route-handlers'
import { createProtectedAdminRouteHandler } from '@/lib/admin-route-handler'

export const GET = createProtectedAdminRouteHandler(
  (request: NextRequest) => handleListLicenseConsumptionsRequest(request),
  {
    logLabel: '获取消费日志失败',
    errorStatus: 400,
    errorMessage: '获取消费日志失败',
    exposeErrorMessage: true,
  },
)
