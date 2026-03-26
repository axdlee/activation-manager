import { NextResponse, type NextRequest } from 'next/server'

import { createProtectedAdminRouteHandler } from '@/lib/admin-route-handler'
import { prisma } from '@/lib/db'
import { updateActivationCodeRebindSettings } from '@/lib/license-code-admin-service'

function parseActivationCodeId(value: string) {
  const id = Number(value)

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('激活码ID无效')
  }

  return id
}

export const PATCH = createProtectedAdminRouteHandler(
  async (
    request: NextRequest,
    authResult,
    context: { params: { id: string } },
  ) => {
    const id = parseActivationCodeId(context.params.id)
    const payload = await request.json()

    if (
      !Object.prototype.hasOwnProperty.call(payload, 'allowAutoRebind') &&
      !Object.prototype.hasOwnProperty.call(payload, 'autoRebindCooldownMinutes') &&
      !Object.prototype.hasOwnProperty.call(payload, 'autoRebindMaxCount')
    ) {
      return NextResponse.json(
        { success: false, message: '至少需要提供 allowAutoRebind、autoRebindCooldownMinutes 或 autoRebindMaxCount' },
        { status: 400 },
      )
    }

    const activationCode = await updateActivationCodeRebindSettings(prisma, {
      id,
      allowAutoRebind: payload.allowAutoRebind,
      autoRebindCooldownMinutes: payload.autoRebindCooldownMinutes,
      autoRebindMaxCount: payload.autoRebindMaxCount,
      adminUsername: authResult.payload?.username,
      reason: typeof payload.reason === 'string' ? payload.reason : undefined,
    })

    return NextResponse.json({
      success: true,
      message: '激活码换绑策略已更新',
      activationCode,
    })
  },
  {
    logLabel: '更新激活码换绑策略失败',
    errorStatus: 400,
    errorMessage: '更新激活码换绑策略失败',
    exposeErrorMessage: true,
  },
)
