import { NextResponse, type NextRequest } from 'next/server'

import { createProtectedAdminRouteHandler } from '@/lib/admin-route-handler'
import { resolveServerLocale, serverT } from '@/lib/i18n/server'
import { prisma } from '@/lib/db'
import {
  forceRebindActivationCode,
  forceUnbindActivationCode,
} from '@/lib/license-code-admin-service'

function parseActivationCodeId(value: string, t: (key: string) => string) {
  const id = Number(value)

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(t('api.codeIdInvalid'))
  }

  return id
}

export const POST = createProtectedAdminRouteHandler(
  async (
    request: NextRequest,
    authResult,
    context: { params: { id: string } },
  ) => {
    const t = serverT(resolveServerLocale(request))
    const id = parseActivationCodeId(context.params.id, t)
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
        message: t('code.bindingRemoved'),
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
        message: t('code.forceRebound'),
        activationCode,
      })
    }

    return NextResponse.json(
      { success: false, message: t('code.actionUnsupported') },
      { status: 400 },
    )
  },
  {
    logLabel: '执行激活码绑定管理操作失败',
    errorStatus: 400,
    errorMessageKey: 'code.actionFailed',
    exposeErrorMessage: true,
  },
)
