import { NextResponse, type NextRequest } from 'next/server'

import { createProtectedAdminRouteHandler } from '@/lib/admin-route-handler'
import { resolveServerLocale, serverT } from '@/lib/i18n/server'
import { prisma } from '@/lib/db'
import { generateActivationCodes } from '@/lib/license-generation-service'
import { recordAdminOperationAuditLog } from '@/lib/admin-operation-audit-service'

/**
 * 预定义商品补货：按商品规格生成 N 个激活码进入码池。
 * POST { productId, amount }
 */
export const POST = createProtectedAdminRouteHandler(
  async (request: NextRequest, authResult) => {
    const t = serverT(resolveServerLocale(request))
    const body = (await request.json()) as { productId?: number; amount?: number }
    const productId = Number(body.productId)
    const rawAmount = Number(body.amount)
    const amount = Number.isFinite(rawAmount)
      ? Math.min(100, Math.max(1, Math.trunc(rawAmount)))
      : 1

    if (!productId) {
      return NextResponse.json({ success: false, message: t('shop.productIdRequired') }, { status: 400 })
    }

    const product = await prisma.shopProduct.findUnique({
      where: { id: productId },
      include: { project: true },
    })

    if (!product) {
      return NextResponse.json({ success: false, message: t('shop.productNotFound') }, { status: 404 })
    }

    if (product.stockMode !== 'PREDEFINED') {
      return NextResponse.json(
        { success: false, message: t('shop.productNotPredefined') },
        { status: 400 },
      )
    }

    // 激活码生成放在事务外：码唯一键冲突重试依赖自动提交（PostgreSQL
    // 事务出错即中止，事务内重试会失败）。事务失败遗留的未入池码只是
    // 多余的库存记录，无害。
    const generated = await generateActivationCodes(prisma, {
      projectKey: product.project.projectKey,
      amount,
      licenseMode: product.licenseMode as 'TIME' | 'COUNT',
      validDays: product.validDays ?? null,
      totalCount: product.totalCount ?? null,
      cardType: product.cardType ?? null,
    })
    const codes = generated.map((code) => code.code)

    // 入池（事务保证一致性）
    const stock = await prisma.$transaction(async (tx) => {
      await tx.shopProductCodeStock.createMany({
        data: generated.map((code) => ({
          productId: product.id,
          activationCodeId: code.id,
          status: 'AVAILABLE',
        })),
      })

      return { codes }
    })

    await recordAdminOperationAuditLog(prisma, {
      adminUsername: authResult.payload?.username ?? 'unknown',
      operationType: 'SHOP_PRODUCT_STOCKED',
      targetLabel: product.name,
      detail: { productId: product.id, amount },
    })

    return NextResponse.json({
      success: true,
      stocked: amount,
      codes: stock.codes,
    })
  },
  { logLabel: 'shop-product-restock' },
)
