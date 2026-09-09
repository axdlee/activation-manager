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
}

export const POST = createProtectedAdminRouteHandler(
  async (request: NextRequest, authResult) => {
    const t = serverT(resolveServerLocale(request))
    const now = new Date()

    const usedCodes = await prisma.activationCode.findMany({
      where: {
        isUsed: true,
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
      },
    })

    const expiredCodes = usedCodes.filter((code: ActivationCodeData) => {
      if (code.usedAt && code.validDays) {
        const actualExpiresAt = new Date(code.usedAt.getTime() + code.validDays * 24 * 60 * 60 * 1000)
        return actualExpiresAt < now
      } else if (code.expiresAt) {
        return code.expiresAt < now
      }
      return false
    })

    if (expiredCodes.length === 0) {
      return NextResponse.json({
        success: true,
        message: t('cleanup.noExpiredFound'),
        cleaned: 0,
      })
    }

    const expiredCodeIds = expiredCodes.map((code: ActivationCodeData) => code.id)
    const result = await prisma.activationCode.updateMany({
      where: {
        id: {
          in: expiredCodeIds,
        },
      },
      data: {
        isUsed: false,
        usedAt: null,
        usedBy: null,
        expiresAt: null,
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

    const usedCodes = await prisma.activationCode.findMany({
      where: {
        isUsed: true,
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
      },
    })

    const expiredCodes = usedCodes.filter((code: ActivationCodeData) => {
      if (code.usedAt && code.validDays) {
        const actualExpiresAt = new Date(code.usedAt.getTime() + code.validDays * 24 * 60 * 60 * 1000)
        return actualExpiresAt < now
      } else if (code.expiresAt) {
        return code.expiresAt < now
      }
      return false
    })

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
