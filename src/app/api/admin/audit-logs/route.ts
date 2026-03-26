import { type NextRequest } from 'next/server'

import { handleListAdminOperationAuditLogsRequest } from '@/lib/admin-audit-route-handlers'
import { createProtectedAdminRouteHandler } from '@/lib/admin-route-handler'

export const GET = createProtectedAdminRouteHandler(
  (request: NextRequest) => handleListAdminOperationAuditLogsRequest(request),
  {
    logLabel: '获取审计日志失败',
    errorStatus: 400,
    errorMessage: '获取审计日志失败',
    exposeErrorMessage: true,
  },
)
