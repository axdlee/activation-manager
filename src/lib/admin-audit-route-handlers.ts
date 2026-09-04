import { PrismaClient } from '@prisma/client'
import { NextResponse } from 'next/server'

import {
  buildAdminOperationDetailSummary,
  getAdminOperationTypeLabel,
} from '@/lib/admin-audit-log-ui'
import {
  listAdminOperationAuditLogs,
  listAdminOperationAuditLogsPage,
} from '@/lib/admin-operation-audit-service'
import { prisma } from '@/lib/db'
import { createCsvRow } from './csv-utils'

function buildAdminOperationAuditCsv(
  logs: Awaited<ReturnType<typeof listAdminOperationAuditLogs>>,
) {
  const rows = [
    createCsvRow(['管理员', '操作类型', '项目', '项目标识', '激活码', '目标', '原因', '详情', '操作时间']),
    ...logs.map((log) =>
      createCsvRow([
        log.adminUsername,
        getAdminOperationTypeLabel(log.operationType),
        log.project?.name || '-',
        log.project?.projectKey || '-',
        log.activationCode?.code || '-',
        log.targetLabel || '-',
        log.reason || '-',
        buildAdminOperationDetailSummary(log.operationType, log.detailJson) || '-',
        new Date(log.createdAt).toISOString(),
      ]),
    ),
  ]

  return `\uFEFF${rows.join('\n')}`
}

export function readAdminOperationAuditFilters(request: Request) {
  const requestUrl = new URL(request.url)

  return {
    projectKey: requestUrl.searchParams.get('projectKey') || undefined,
    keyword: requestUrl.searchParams.get('keyword') || undefined,
    operationType: requestUrl.searchParams.get('operationType') || undefined,
    createdFrom: requestUrl.searchParams.get('createdFrom') || undefined,
    createdTo: requestUrl.searchParams.get('createdTo') || undefined,
  }
}

export function readAdminOperationAuditPagination(request: Request) {
  const requestUrl = new URL(request.url)
  const rawPage = requestUrl.searchParams.get('page')
  const rawPageSize = requestUrl.searchParams.get('pageSize')

  return {
    page: rawPage ? Number(rawPage) : undefined,
    pageSize: rawPageSize ? Number(rawPageSize) : undefined,
  }
}

export async function handleListAdminOperationAuditLogsRequest(
  request: Request,
  client: PrismaClient = prisma,
) {
  const { logs, pagination } = await listAdminOperationAuditLogsPage(client, {
    ...readAdminOperationAuditFilters(request),
    ...readAdminOperationAuditPagination(request),
  })

  return Response.json({
    success: true,
    logs,
    pagination,
  })
}

export const ADMIN_AUDIT_EXPORT_MAX_ROWS = 100_000

export async function handleExportAdminOperationAuditLogsRequest(
  request: Request,
  client: PrismaClient = prisma,
) {
  const logs = await listAdminOperationAuditLogs(client, {
    ...readAdminOperationAuditFilters(request),
    limit: ADMIN_AUDIT_EXPORT_MAX_ROWS + 1, // +1 检测是否超限
  })
  const filename = `admin_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`

  if (logs.length > ADMIN_AUDIT_EXPORT_MAX_ROWS) {
    return NextResponse.json(
      {
        success: false,
        message: `导出数量超过上限（${ADMIN_AUDIT_EXPORT_MAX_ROWS.toLocaleString()} 条），请缩小筛选范围后重试`,
      },
      { status: 400 },
    )
  }

  return new Response(buildAdminOperationAuditCsv(logs), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
