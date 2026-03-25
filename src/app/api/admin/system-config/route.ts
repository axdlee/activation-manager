import { NextResponse, type NextRequest } from 'next/server'

import { createProtectedAdminRouteHandler } from '@/lib/admin-route-handler'
import { getAllConfigsWithMeta, sanitizeSystemConfigsForAdmin } from '@/lib/config-service'
import { prepareSystemConfigUpdates } from '@/lib/system-config-updates'
import { InvalidSystemConfigPayloadError, persistSystemConfigUpdates } from '@/lib/system-config-write'

// 获取所有系统配置
export const GET = createProtectedAdminRouteHandler(
  async () => {
    const configs = sanitizeSystemConfigsForAdmin(await getAllConfigsWithMeta())

    return NextResponse.json({
      success: true,
      configs,
    })
  },
  {
    logLabel: '获取系统配置失败',
    errorStatus: 500,
    errorMessage: '获取系统配置失败',
  },
)

// 更新系统配置
export const POST = createProtectedAdminRouteHandler(
  async (request: NextRequest) => {
    const { configs } = await request.json()

    if (!configs || !Array.isArray(configs)) {
      return NextResponse.json(
        {
          success: false,
          message: '配置数据格式错误',
        },
        { status: 400 },
      )
    }

    await persistSystemConfigUpdates(prepareSystemConfigUpdates(configs))

    return NextResponse.json({
      success: true,
      message: '系统配置更新成功',
    })
  },
  {
    logLabel: '更新系统配置失败',
    errorStatus: 500,
    errorMessage: '更新系统配置失败',
    resolveErrorResponse: (error) =>
      error instanceof InvalidSystemConfigPayloadError
        ? {
            status: 400,
            message: error.message,
          }
        : null,
  },
)
