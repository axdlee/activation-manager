import { NextResponse, type NextRequest } from 'next/server'

import { createProtectedAdminRouteHandler } from '@/lib/admin-route-handler'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * 通知投递日志查询（管理员）：
 * GET /api/admin/notifications/logs?event=&channel=&status=&relatedId=&page=&pageSize=
 * 每次实际投递（非跳过）一条记录；用于排查「通知没收到」与投递失败重试决策。
 */
export const GET = createProtectedAdminRouteHandler(async (request: NextRequest) => {
  const url = request.nextUrl
  const event = url.searchParams.get('event') ?? ''
  const channel = url.searchParams.get('channel') ?? ''
  const status = url.searchParams.get('status') ?? ''
  const relatedId = url.searchParams.get('relatedId') ?? ''
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize')) || 20))

  const where = {
    ...(event ? { event } : {}),
    ...(channel ? { channel } : {}),
    ...(status ? { status } : {}),
    ...(relatedId ? { relatedId } : {}),
  }

  const [logs, total] = await Promise.all([
    prisma.notificationLog.findMany({
      where,
      orderBy: { id: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.notificationLog.count({ where }),
  ])

  return NextResponse.json({
    success: true,
    logs,
    pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
  })
}, { logLabel: 'notification-logs-list' })
