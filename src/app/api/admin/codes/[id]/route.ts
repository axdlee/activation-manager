import { NextResponse, type NextRequest } from 'next/server'

import { createProtectedAdminRouteHandler } from '@/lib/admin-route-handler'
import { resolveServerLocale, serverT } from '@/lib/i18n/server'
import { prisma } from '@/lib/db'
import { updateActivationCodeRebindSettings } from '@/lib/license-code-admin-service'

function parseActivationCodeId(value: string, t: (key: string) => string) {
  const id = Number(value)

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(t('api.codeIdInvalid'))
  }

  return id
}

// GET 单码详情：含绑定历史与管理员审计（列表页改为服务端分页后按需加载）
export const GET = createProtectedAdminRouteHandler(
  async (request: NextRequest, _authResult, context: { params: { id: string } }) => {
    const t = serverT(resolveServerLocale(request))
    const id = parseActivationCodeId(context.params.id, t)

    const activationCode = await prisma.activationCode.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            projectKey: true,
            allowAutoRebind: true,
            autoRebindCooldownMinutes: true,
            autoRebindMaxCount: true,
          },
        },
        bindingHistories: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        adminAuditLogs: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    })

    if (!activationCode) {
      return NextResponse.json(
        { success: false, message: t('code.notFound') },
        { status: 404 },
      )
    }

    return NextResponse.json({
      success: true,
      activationCode,
    })
  },
  {
    logLabel: '获取激活码详情时发生错误',
    errorStatus: 500,
    errorMessageKey: 'api.internalError',
  },
)

export const PATCH = createProtectedAdminRouteHandler(
  async (
    request: NextRequest,
    authResult,
    context: { params: { id: string } },
  ) => {
    const t = serverT(resolveServerLocale(request))
    const id = parseActivationCodeId(context.params.id, t)
    const payload = await request.json()

    if (
      !Object.prototype.hasOwnProperty.call(payload, 'allowAutoRebind') &&
      !Object.prototype.hasOwnProperty.call(payload, 'autoRebindCooldownMinutes') &&
      !Object.prototype.hasOwnProperty.call(payload, 'autoRebindMaxCount')
    ) {
      return NextResponse.json(
        { success: false, message: t('rebind.policyRequired') },
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
      message: t('code.rebindPolicyUpdated'),
      activationCode,
    })
  },
  {
    logLabel: '更新激活码换绑策略失败',
    errorStatus: 400,
    errorMessageKey: 'code.rebindPolicyUpdateFailed',
    exposeErrorMessage: true,
  },
)
