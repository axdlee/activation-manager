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

// GET 单码详情：含绑定历史与管理员审计（列表页改为服务端分页后按需加载）
export const GET = createProtectedAdminRouteHandler(
  async (_request: NextRequest, _authResult, context: { params: { id: string } }) => {
    const id = parseActivationCodeId(context.params.id)

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
        { success: false, message: '激活码不存在' },
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
    errorMessage: '服务器内部错误',
  },
)

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
