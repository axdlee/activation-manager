import { NextResponse, type NextRequest } from 'next/server'

import { createProtectedAdminRouteHandler } from '@/lib/admin-route-handler'
import { prisma } from '@/lib/db'
import {
  forceRebindActivationCode,
  forceUnbindActivationCode,
} from '@/lib/license-code-admin-service'

function parseActivationCodeId(value: string) {
  const id = Number(value)

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('激活码ID无效')
  }

  return id
}

export const POST = createProtectedAdminRouteHandler(
  async (
    request: NextRequest,
    authResult,
    context: { params: { id: string } },
  ) => {
    const id = parseActivationCodeId(context.params.id)
    const payload = await request.json()
    const action = String(payload.action || '').trim()

    if (action === 'unbind') {
      const activationCode = await forceUnbindActivationCode(prisma, {
        id,
        adminUsername: authResult.payload?.username,
        reason: typeof payload.reason === 'string' ? payload.reason : undefined,
      })

      return NextResponse.json({
        success: true,
        message: '激活码绑定已解除',
        activationCode,
      })
    }

    if (action === 'rebind') {
      const activationCode = await forceRebindActivationCode(prisma, {
        id,
        machineId: String(payload.machineId || ''),
        adminUsername: authResult.payload?.username,
        reason: typeof payload.reason === 'string' ? payload.reason : undefined,
      })

      return NextResponse.json({
        success: true,
        message: '激活码已强制换绑到新设备',
        activationCode,
      })
    }

    return NextResponse.json(
      { success: false, message: '仅支持 unbind 或 rebind 动作' },
      { status: 400 },
    )
  },
  {
    logLabel: '执行激活码绑定管理操作失败',
    errorStatus: 400,
    errorMessage: '执行激活码绑定管理操作失败',
    exposeErrorMessage: true,
  },
)
