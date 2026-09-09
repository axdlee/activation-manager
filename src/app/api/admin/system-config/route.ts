import { NextResponse, type NextRequest } from 'next/server'

import { createProtectedAdminRouteHandler } from '@/lib/admin-route-handler'
import { type AdminAuthSuccessResult } from '@/lib/admin-auth-shared'
import { resolveServerLocale, serverT } from '@/lib/i18n/server'
import { prisma } from '@/lib/db'
import { getAllConfigsWithMeta, sanitizeSystemConfigsForAdmin } from '@/lib/config-service'
import { prepareSystemConfigUpdates } from '@/lib/system-config-updates'
import { InvalidSystemConfigPayloadError, persistSystemConfigUpdates } from '@/lib/system-config-write'
import { recordAdminOperationAuditLog } from '@/lib/admin-operation-audit-service'

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
    errorMessageKey: 'sysconf.getFailed',
  },
)

// 更新系统配置
export const POST = createProtectedAdminRouteHandler(
  async (request: NextRequest, authResult: AdminAuthSuccessResult) => {
    const t = serverT(resolveServerLocale(request))
    const { configs } = await request.json()

    if (!configs || !Array.isArray(configs)) {
      return NextResponse.json(
        {
          success: false,
          message: t('sysconf.payloadInvalid'),
        },
        { status: 400 },
      )
    }

    await persistSystemConfigUpdates(prepareSystemConfigUpdates(configs))

    await recordAdminOperationAuditLog(prisma, {
      adminUsername: authResult.payload?.username ?? 'unknown',
      operationType: 'SYSTEM_CONFIG_UPDATED',
      projectId: null,
      targetLabel: 'system-config',
    })

    return NextResponse.json({
      success: true,
      message: t('sysconf.updateSuccess'),
    })
  },
  {
    logLabel: '更新系统配置失败',
    errorStatus: 500,
    errorMessageKey: 'sysconf.updateFailed',
    resolveErrorResponse: (error, request) => {
      if (!(error instanceof InvalidSystemConfigPayloadError)) {
        return null
      }

      const t = serverT(resolveServerLocale(request))
      return {
        status: 400,
        message: error.messageKey
          ? t(error.messageKey, error.messageParams)
          : error.message,
      }
    },
  },
)
