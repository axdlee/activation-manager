import { NextResponse, type NextRequest } from 'next/server'

import { createProtectedAdminRouteHandler } from '@/lib/admin-route-handler'
import { resolveServerLocale, serverT } from '@/lib/i18n/server'
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
  const t = serverT(resolveServerLocale(request))
  const body = (await request.json()) as UpsertConfigBody

  if (!body.provider) {
    return NextResponse.json({ success: false, message: t('api.channelIdRequired') }, { status: 400 })
  }

  const provider = getPaymentProvider(body.provider)
  if (!provider) {
    return NextResponse.json({ success: false, message: t('shop.paymentProviderDisabled') }, { status: 400 })
  }

  // 启用渠道前的安全闸门：
  // 1) 回调验签未实现的渠道（callbackTrust === 'placeholder'）禁止启用，
  //    否则伪造回调即可免费发卡（alipay/wechat 当前属此类）
  // 2) 必需配置键不齐禁止启用（如 webhook 必须配置 secret）
  if (body.isEnabled === true) {
    if (provider.callbackTrust === 'placeholder') {
      return NextResponse.json(
        {
          success: false,
          message: '该渠道回调验签尚未实现，暂禁止启用；请先完成真实验签接入',
        },
        { status: 400 },
      )
    }

    let candidateConfig: Record<string, unknown> = {}
    const rawConfig = body.configJson ?? (await prisma.shopPaymentConfig.findUnique({
      where: { provider: body.provider },
    }))?.configJson ?? '{}'
    try {
      candidateConfig = JSON.parse(rawConfig) as Record<string, unknown>
    } catch {
      return NextResponse.json({ success: false, message: '渠道配置不是合法 JSON' }, { status: 400 })
    }

    const missingKeys = provider.requiredConfigKeys.filter(
      (key) => typeof candidateConfig[key] !== 'string' || !(candidateConfig[key] as string).trim(),
    )
    if (missingKeys.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `渠道配置不完整，缺少必填项：${missingKeys.join(', ')}`,
          missingKeys,
        },
        { status: 400 },
      )
    }
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
