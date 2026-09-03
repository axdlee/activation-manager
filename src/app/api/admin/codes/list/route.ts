import { NextResponse, type NextRequest } from 'next/server'

import { createProtectedAdminRouteHandler } from '@/lib/admin-route-handler'
import { prisma } from '@/lib/db'
import { listActivationCodes } from '@/lib/license-code-list-service'

const VALID_STATUS_FILTERS = new Set(['all', 'unused', 'used', 'expired', 'depleted'])

export const GET = createProtectedAdminRouteHandler(
  async (request: NextRequest) => {
    const { searchParams } = new URL(request.url)

    const rawStatus = searchParams.get('status') ?? 'all'
    const status = VALID_STATUS_FILTERS.has(rawStatus)
      ? (rawStatus as 'all' | 'unused' | 'used' | 'expired' | 'depleted')
      : 'all'

    const result = await listActivationCodes(prisma, {
      keyword: searchParams.get('keyword') ?? undefined,
      status,
      projectKey: searchParams.get('projectKey') ?? undefined,
      cardType: searchParams.get('cardType') ?? undefined,
      page: searchParams.get('page') ? Number(searchParams.get('page')) : undefined,
      pageSize: searchParams.get('pageSize') ? Number(searchParams.get('pageSize')) : undefined,
    })

    return NextResponse.json({
      success: true,
      codes: result.codes,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
      statusSummary: result.statusSummary,
      projectCoverage: result.projectCoverage,
      availableCardTypes: result.availableCardTypes,
    })
  },
  {
    logLabel: '获取激活码列表时发生错误',
    errorStatus: 500,
    errorMessage: '服务器内部错误',
  },
)
