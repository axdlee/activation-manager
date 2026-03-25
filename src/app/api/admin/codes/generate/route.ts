import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, createAuthResponse } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'
import { generateActivationCodes } from '@/lib/license-generation-service'

export async function POST(request: NextRequest) {
  try {
    // 使用认证中间件验证
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return createAuthResponse(authResult)
    }

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
      codes
    })

  } catch (error) {
    console.error('生成激活码时发生错误:', error)
    const message = error instanceof Error ? error.message : '服务器内部错误'
    return NextResponse.json(
      { success: false, message },
      { status: message === '服务器内部错误' ? 500 : 400 }
    )
  }
}
