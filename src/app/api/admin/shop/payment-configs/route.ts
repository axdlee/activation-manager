import { NextResponse, type NextRequest } from 'next/server'

import { createProtectedAdminRouteHandler } from '@/lib/admin-route-handler'
import { prisma } from '@/lib/db'
import { getPaymentProvider } from '@/lib/shop-payment-registry'

/**
 * 支付渠道配置（后台）：启用/停用渠道，设置渠道参数。
 */
export const GET = createProtectedAdminRouteHandler(async () => {
  const configs = await prisma.shopPaymentConfig.findMany({
    orderBy: { provider: 'asc' },
  })

  return NextResponse.json({
    success: true,
    configs: configs.map((config) => {
      const provider = getPaymentProvider(config.provider)
      let parsedConfig: Record<string, string> = {}
      try {
        const parsed = JSON.parse(config.configJson) as Record<string, unknown>
        for (const [key, value] of Object.entries(parsed)) {
          if (typeof value === 'string') parsedConfig[key] = value
        }
      } catch {
        parsedConfig = {}
      }

      const requiredConfigKeys = provider?.requiredConfigKeys ?? []
      const missingKeys = requiredConfigKeys.filter((key) => !parsedConfig[key]?.trim())

      return {
        provider: config.provider,
        configJson: config.configJson,
        isEnabled: config.isEnabled,
        requiredConfigKeys,
        missingKeys,
        configComplete: missingKeys.length === 0,
      }
    }),
  })
}, { logLabel: 'shop-payment-configs' })

type UpsertConfigBody = {
  provider: string
  configJson?: string
  isEnabled?: boolean
}

export const POST = createProtectedAdminRouteHandler(async (request: NextRequest) => {
  const body = (await request.json()) as UpsertConfigBody

  if (!body.provider) {
    return NextResponse.json({ success: false, message: '缺少渠道标识' }, { status: 400 })
  }

  const config = await prisma.shopPaymentConfig.upsert({
    where: { provider: body.provider },
    update: {
      ...(body.configJson !== undefined ? { configJson: body.configJson } : {}),
      ...(body.isEnabled !== undefined ? { isEnabled: body.isEnabled } : {}),
    },
    create: {
      provider: body.provider,
      configJson: body.configJson ?? '{}',
      isEnabled: body.isEnabled ?? false,
    },
  })

  return NextResponse.json({ success: true, config })
}, { logLabel: 'shop-payment-configs-upsert' })
