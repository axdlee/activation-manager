import { NextResponse, type NextRequest } from 'next/server'

import { createProtectedAdminRouteHandler } from '@/lib/admin-route-handler'
import { resolveServerLocale, serverT } from '@/lib/i18n/server'
import { prisma } from '@/lib/db'
import { recordAdminOperationAuditLog } from '@/lib/admin-operation-audit-service'

// 定义激活码类型
interface ActivationCodeData {
  id: number
  code: string
  isUsed: boolean
  usedAt: Date | null
  usedBy: string | null
  createdAt: Date
  expiresAt: Date | null
  validDays: number | null
  licenseMode: string
}

/**
 * 过期判定（与全代码库口径一致）：仅 TIME 型按时间判过期，COUNT 型
 * 只按次数耗尽、不受时间约束，因此不进入「清理过期绑定」范围——
 * 给 COUNT 码释放绑定等于把剩余次数送给新设备。
 */
function isExpiredCode(code: ActivationCodeData, now: Date): boolean {
  if (code.licenseMode === 'COUNT') {
    return false
  }
  if (code.usedAt && code.validDays) {
    const actualExpiresAt = new Date(code.usedAt.getTime() + code.validDays * 24 * 60 * 60 * 1000)
    return actualExpiresAt < now
  }
  if (code.expiresAt) {
    return code.expiresAt < now
  }
  return false
}

export const POST = createProtectedAdminRouteHandler(
  async (request: NextRequest, authResult) => {
    const t = serverT(resolveServerLocale(request))
    const now = new Date()

    // 软删除的码不参与过期绑定清理
    const usedCodes = await prisma.activationCode.findMany({
      where: {
        isUsed: true,
        deletedAt: null,
      },
      select: {
        id: true,
        code: true,
        isUsed: true,
        usedAt: true,
        usedBy: true,
        createdAt: true,
        expiresAt: true,
        validDays: true,
        licenseMode: true,
      },
    })

    const expiredCodes = usedCodes.filter((code: ActivationCodeData) => isExpiredCode(code, now))

    if (expiredCodes.length === 0) {
      return NextResponse.json({
        success: true,
        message: t('cleanup.noExpiredFound'),
        cleaned: 0,
      })
    }

    const expiredCodeIds = expiredCodes.map((code: ActivationCodeData) => code.id)
    // 只释放设备绑定（usedBy 为机器ID / lastBoundAt），绝不重置
    // isUsed / usedAt / expiresAt / validDays——此前的实现把它们一并
    // 清零，导致过期授权「复活」：换台新设备重新激活又拿到完整时长。
    // 保留过期状态后，这些码仍会被激活/查询流程的过期检查拒绝。
    const result = await prisma.activationCode.updateMany({
      where: {
        id: {
          in: expiredCodeIds,
        },
      },
      data: {
        usedBy: null,
        lastBoundAt: null,
      },
    })

    await recordAdminOperationAuditLog(prisma, {
      adminUsername: authResult.payload?.username ?? 'unknown',
      operationType: 'CODE_CLEANUP_EXPIRED',
      detail: {
        cleanedCount: result.count,
        expiredCodeIds,
      },
    })

    return NextResponse.json({
      success: true,
      message: t('cleanup.bindingSuccess', { count: result.count }),
      cleaned: result.count,
      expiredCodes: expiredCodes.map((code: ActivationCodeData) => ({
        code: code.code,
        usedBy: code.usedBy,
        expiresAt: code.expiresAt,
      })),
    })
  },
  {
    logLabel: '清理过期激活码时发生错误',
    errorStatus: 500,
    errorMessageKey: 'api.internalError',
  },
)

// 获取过期激活码统计
export const GET = createProtectedAdminRouteHandler(
  async (_request: NextRequest) => {
    const now = new Date()

    // 软删除的码不参与过期绑定清理
    const usedCodes = await prisma.activationCode.findMany({
      where: {
        isUsed: true,
        deletedAt: null,
      },
      select: {
        id: true,
        code: true,
        isUsed: true,
        usedAt: true,
        usedBy: true,
        createdAt: true,
        expiresAt: true,
        validDays: true,
        licenseMode: true,
      },
    })

    const expiredCodes = usedCodes.filter((code: ActivationCodeData) => isExpiredCode(code, now))

    return NextResponse.json({
      success: true,
      count: expiredCodes.length,
      expiredCodes,
    })
  },
  {
    logLabel: '获取过期激活码时发生错误',
    errorStatus: 500,
    errorMessageKey: 'api.internalError',
  },
)
