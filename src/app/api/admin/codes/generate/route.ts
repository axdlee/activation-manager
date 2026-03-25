import { NextResponse, type NextRequest } from 'next/server'

import { createProtectedAdminRouteHandler } from '@/lib/admin-route-handler'
import { prisma } from '@/lib/db'
import { generateActivationCodes } from '@/lib/license-generation-service'

export const POST = createProtectedAdminRouteHandler(
  async (request: NextRequest) => {
    const { amount, expiryDays, cardType, projectKey, licenseMode, totalCount } = await request.json()

    const codes = await generateActivationCodes(prisma, {
      projectKey,
      amount,
      licenseMode: licenseMode || 'TIME',
      validDays: expiryDays || null,
      totalCount: totalCount || null,
      cardType: cardType || null,
    })

    return NextResponse.json({
      success: true,
      message: `成功生成 ${amount} 个激活码`,
      codes,
    })
  },
  {
    logLabel: '生成激活码时发生错误',
    errorStatus: 500,
    errorMessage: '服务器内部错误',
    resolveErrorResponse: (error) =>
      error instanceof Error
        ? {
            status: 400,
            message: error.message,
          }
        : null,
  },
)
