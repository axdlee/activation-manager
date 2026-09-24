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

    // 事务内删除：同步清理码池库存行（shopProductCodeStock 对激活码
    // 没有外键，不清理会留下悬空库存，导致该商品后续每一单发卡失败）
    try {
      await prisma.$transaction(async (tx) => {
        await tx.shopProductCodeStock.deleteMany({
          where: { activationCodeId: codeId },
        })
        await tx.activationCode.delete({
          where: { id: codeId },
        })
      })
    } catch (error) {
      // 绑定历史 / 消费记录对激活码是 RESTRICT 外键：激活过的码不允许
      // 物理删除（后续批次将改为软删除）。此前实现先写审计后删除，
      // 删除失败时审计里留下假的「已删除」记录，这里改为失败时返回
      // 明确的业务冲突，不写审计。
      if (
        error instanceof Error &&
        (error.message.includes('Foreign key constraint') ||
          error.message.includes('foreign key'))
      ) {
        return NextResponse.json(
          {
            success: false,
            message: '该激活码存在绑定历史或消费记录，无法删除；如需回收请使用停用/解绑',
          },
          { status: 409 },
        )
      }
      throw error
    }

    // 审计在删除成功后写入（不引用已删除的 activationCodeId，保留
    // targetLabel 以便追溯）
    await recordAdminOperationAuditLog(prisma, {
      adminUsername: authResult.payload?.username ?? 'unknown',
      operationType: 'CODE_DELETED',
      projectId: existingCode.projectId,
      targetLabel: existingCode.code,
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
