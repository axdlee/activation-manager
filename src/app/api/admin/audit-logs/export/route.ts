import { type NextRequest } from 'next/server'

import { handleExportAdminOperationAuditLogsRequest } from '@/lib/admin-audit-route-handlers'
import { createProtectedAdminRouteHandler } from '@/lib/admin-route-handler'

export const GET = createProtectedAdminRouteHandler(
  (request: NextRequest) => handleExportAdminOperationAuditLogsRequest(request),
  {
    logLabel: '导出审计日志失败',
    errorStatus: 400,
    errorMessage: '导出审计日志失败',
    exposeErrorMessage: true,
  },
)
