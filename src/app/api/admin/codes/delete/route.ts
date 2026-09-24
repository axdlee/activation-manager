import { NextResponse, type NextRequest } from 'next/server'

import { createProtectedAdminRouteHandler } from '@/lib/admin-route-handler'
import { resolveServerLocale, serverT } from '@/lib/i18n/server'
import { prisma } from '@/lib/db'
import { recordAdminOperationAuditLog } from '@/lib/admin-operation-audit-service'

interface DeleteRouteAuthResult {
  payload?: { username?: string } | null
}

// 可注入 prisma 客户端（测试用临时库），生产路径绑定全局单例
export async function deleteActivationCodeRoute(
  request: NextRequest,
  authResult: DeleteRouteAuthResult,
  client: typeof prisma = prisma
) {
  const t = serverT(resolveServerLocale(request))
  const { id } = await request.json()

  if (!id) {
    return NextResponse.json(
      { success: false, message: t('code.idRequired') },
      { status: 400 }
    )
  }

  const codeId = parseInt(id)

  // 检查激活码是否存在（已软删除的视同不存在）
  const existingCode = await client.activationCode.findFirst({
    where: { id: codeId, deletedAt: null }
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
    await client.$transaction(async (tx) => {
      await tx.shopProductCodeStock.deleteMany({
        where: { activationCodeId: codeId },
      })
      await tx.activationCode.delete({
        where: { id: codeId },
      })
    })
  } catch (error) {
    // 绑定历史 / 消费记录对激活码是 RESTRICT 外键。激活过的码改为
    // 软删除：打 deletedAt 标记，所有激活/查询/列表/发卡/清理路径
    // 都视其为不存在，但绑定与消费历史完整保留可追溯。
    if (
      error instanceof Error &&
      (error.message.includes('Foreign key constraint') ||
        error.message.includes('foreign key'))
    ) {
      await client.$transaction(async (tx) => {
        await tx.shopProductCodeStock.deleteMany({
          where: { activationCodeId: codeId },
        })
        await tx.activationCode.update({
          where: { id: codeId },
          data: { deletedAt: new Date(), usedBy: null },
        })
      })

      await recordAdminOperationAuditLog(client, {
        adminUsername: authResult.payload?.username ?? 'unknown',
        operationType: 'CODE_DELETED',
        projectId: existingCode.projectId,
        targetLabel: existingCode.code,
        reason: '软删除：该码存在绑定历史或消费记录，已标记删除并保留历史',
        detail: {
          softDeleted: true,
          codeId,
          releasedUsedBy: existingCode.usedBy ?? null,
        },
      })

      return NextResponse.json({
        success: true,
        message: '该激活码存在绑定历史，已软删除（历史保留、码立即失效）',
      })
    }
    throw error
  }

  // 审计在删除成功后写入（不引用已删除的 activationCodeId，保留
  // targetLabel 以便追溯）
  await recordAdminOperationAuditLog(client, {
    adminUsername: authResult.payload?.username ?? 'unknown',
    operationType: 'CODE_DELETED',
    projectId: existingCode.projectId,
    targetLabel: existingCode.code,
  })

  return NextResponse.json({
    success: true,
    message: t('code.deleteSuccess'),
  })
}

export const DELETE = createProtectedAdminRouteHandler(
  async (request: NextRequest, authResult) =>
    deleteActivationCodeRoute(request, authResult, prisma),
  {
    logLabel: '删除激活码时发生错误',
    errorStatus: 500,
    errorMessageKey: 'api.internalError',
  },
)
