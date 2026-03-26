import { NextResponse, type NextRequest } from 'next/server'

import { createProtectedAdminRouteHandler } from '@/lib/admin-route-handler'
import { recordAdminOperationAuditLog } from '@/lib/admin-operation-audit-service'
import { prisma } from '@/lib/db'
import { generateActivationCodes } from '@/lib/license-generation-service'

export const POST = createProtectedAdminRouteHandler(
  async (request: NextRequest, authResult) => {
    const {
      amount,
      expiryDays,
      cardType,
      projectKey,
      licenseMode,
      totalCount,
      allowAutoRebind,
      autoRebindCooldownMinutes,
      autoRebindMaxCount,
    } = await request.json()

    const codes = await generateActivationCodes(prisma, {
      projectKey,
      amount,
      licenseMode: licenseMode || 'TIME',
      validDays: expiryDays || null,
      totalCount: totalCount || null,
      cardType: cardType || null,
      allowAutoRebind,
      autoRebindCooldownMinutes,
      autoRebindMaxCount,
    })

    if (authResult.payload?.username && codes.length > 0) {
      await recordAdminOperationAuditLog(prisma, {
        adminUsername: authResult.payload.username,
        operationType: 'CODE_BATCH_GENERATED',
        projectId: codes[0]?.projectId,
        targetLabel: codes[0]?.project?.projectKey || projectKey || null,
        detail: {
          amount: codes.length,
          licenseMode: licenseMode || 'TIME',
          validDays: licenseMode === 'TIME' ? expiryDays || null : null,
          totalCount: licenseMode === 'COUNT' ? totalCount || null : null,
          allowAutoRebind: codes[0]?.allowAutoRebind ?? null,
          autoRebindCooldownMinutes: codes[0]?.autoRebindCooldownMinutes ?? null,
          autoRebindMaxCount: codes[0]?.autoRebindMaxCount ?? null,
        },
      })
    }

    return NextResponse.json({
      success: true,
      message: `成功生成 ${amount} 个激活码`,
      codes,
    })
  },
  {
    logLabel: '生成激活码时发生错误',
    errorStatus: 500,
    errorMessage: '服务器内部错误',
    resolveErrorResponse: (error) =>
      error instanceof Error
        ? {
            status: 400,
            message: error.message,
          }
        : null,
  },
)
