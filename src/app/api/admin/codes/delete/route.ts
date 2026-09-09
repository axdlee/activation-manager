import { NextResponse, type NextRequest } from 'next/server'

import { createProtectedAdminRouteHandler } from '@/lib/admin-route-handler'
import { resolveServerLocale, serverT } from '@/lib/i18n/server'
import { prisma } from '@/lib/db'
import { recordAdminOperationAuditLog } from '@/lib/admin-operation-audit-service'

export const DELETE = createProtectedAdminRouteHandler(
  async (request: NextRequest, authResult) => {
    const t = serverT(resolveServerLocale(request))
    const { id } = await request.json()

    if (!id) {
      return NextResponse.json(
        { success: false, message: t('code.idRequired') },
        { status: 400 }
      )
    }

    const codeId = parseInt(id)

    // 检查激活码是否存在
    const existingCode = await prisma.activationCode.findUnique({
      where: { id: codeId }
    })

    if (!existingCode) {
      return NextResponse.json(
        { success: false, message: t('code.notFound') },
        { status: 404 }
      )
    }

    // 先写审计（删除前，activationCodeId 仍可引用原记录）
    await recordAdminOperationAuditLog(prisma, {
      adminUsername: authResult.payload?.username ?? 'unknown',
      operationType: 'CODE_DELETED',
      activationCodeId: codeId,
      projectId: existingCode.projectId,
      targetLabel: existingCode.code,
    })

    // 删除激活码
    await prisma.activationCode.delete({
      where: { id: codeId }
    })

    return NextResponse.json({
      success: true,
      message: t('code.deleteSuccess'),
    })
  },
  {
    logLabel: '删除激活码时发生错误',
    errorStatus: 500,
    errorMessageKey: 'api.internalError',
  },
)
