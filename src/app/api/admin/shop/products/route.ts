import { NextResponse, type NextRequest } from 'next/server'

import { createProtectedAdminRouteHandler } from '@/lib/admin-route-handler'
import { resolveServerLocale, serverT } from '@/lib/i18n/server'
import { prisma } from '@/lib/db'
import { recordAdminOperationAuditLog } from '@/lib/admin-operation-audit-service'

// 商品列表（后台，含未启用）
export const GET = createProtectedAdminRouteHandler(async () => {
  const products = await prisma.shopProduct.findMany({
    include: { project: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  })

  return NextResponse.json({
    success: true,
    products: products.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      projectId: product.projectId,
      projectKey: product.project.projectKey,
      licenseMode: product.licenseMode,
      cardType: product.cardType,
      validDays: product.validDays,
      totalCount: product.totalCount,
      priceInCents: product.priceInCents,
      isEnabled: product.isEnabled,
      sortOrder: product.sortOrder,
    })),
  })
}, { logLabel: "shop-products" })

type CreateProductBody = {
  name?: string
  description?: string
  projectId?: number
  licenseMode?: string
  cardType?: string
  validDays?: number | null
  totalCount?: number | null
  priceInCents?: number
  isEnabled?: boolean
  sortOrder?: number
  stockMode?: 'DYNAMIC' | 'PREDEFINED'
}

export const POST = createProtectedAdminRouteHandler(
  async (request: NextRequest, authResult) => {
    const t = serverT(resolveServerLocale(request))
    const body = (await request.json()) as CreateProductBody

    if (!body.name || !body.projectId || !body.licenseMode || body.priceInCents === undefined) {
      return NextResponse.json({ success: false, message: t('shop.requiredFieldsMissing') }, { status: 400 })
    }

    const project = await prisma.project.findUnique({ where: { id: Number(body.projectId) } })
    if (!project) {
      return NextResponse.json({ success: false, message: t('project.notFound') }, { status: 404 })
    }

    const price = Number(body.priceInCents)
    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json({ success: false, message: t('shop.priceInvalid') }, { status: 400 })
    }

    const product = await prisma.shopProduct.create({
      data: {
        name: body.name.trim(),
        description: body.description?.trim() || null,
        projectId: Number(body.projectId),
        licenseMode: body.licenseMode,
        cardType: body.cardType?.trim() || null,
        validDays: body.validDays ?? null,
        totalCount: body.totalCount ?? null,
        priceInCents: Math.round(price),
        isEnabled: body.isEnabled ?? true,
        sortOrder: body.sortOrder ?? 0,
        stockMode: body.stockMode === 'PREDEFINED' ? 'PREDEFINED' : 'DYNAMIC',
      },
    })

    await recordAdminOperationAuditLog(prisma, {
      adminUsername: authResult.payload?.username ?? 'unknown',
      operationType: 'SHOP_PRODUCT_CREATED',
      targetLabel: product.name,
      detail: { productId: product.id, priceInCents: product.priceInCents },
    })

    return NextResponse.json({ success: true, product })
  },
  { logLabel: 'shop-product-create' },
)
