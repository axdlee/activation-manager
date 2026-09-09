import { NextResponse, type NextRequest } from 'next/server'

import { createProtectedAdminRouteHandler } from '@/lib/admin-route-handler'
import { resolveServerLocale, serverT } from '@/lib/i18n/server'
import { prisma } from '@/lib/db'
import { recordAdminOperationAuditLog } from '@/lib/admin-operation-audit-service'

type UpdateProductBody = {
  name?: string
  description?: string | null
  licenseMode?: string
  cardType?: string | null
  validDays?: number | null
  totalCount?: number | null
  priceInCents?: number
  isEnabled?: boolean
  sortOrder?: number
  stockMode?: 'DYNAMIC' | 'PREDEFINED'
}

export const PATCH = createProtectedAdminRouteHandler(
  async (request: NextRequest, authResult, { params }: { params: { id: string } }) => {
    const t = serverT(resolveServerLocale(request))
    const id = Number(params.id)
    const existing = await prisma.shopProduct.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ success: false, message: t('shop.productNotFound') }, { status: 404 })
    }

    const body = (await request.json()) as UpdateProductBody

    if (body.priceInCents !== undefined) {
      const price = Number(body.priceInCents)
      if (!Number.isFinite(price) || price < 0) {
        return NextResponse.json({ success: false, message: t('shop.priceInvalid') }, { status: 400 })
      }
    }

    const product = await prisma.shopProduct.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.description !== undefined ? { description: body.description?.trim() || null } : {}),
        ...(body.licenseMode !== undefined ? { licenseMode: body.licenseMode } : {}),
        ...(body.cardType !== undefined ? { cardType: body.cardType?.trim() || null } : {}),
        ...(body.validDays !== undefined ? { validDays: body.validDays } : {}),
        ...(body.totalCount !== undefined ? { totalCount: body.totalCount } : {}),
        ...(body.priceInCents !== undefined ? { priceInCents: Math.round(Number(body.priceInCents)) } : {}),
        ...(body.isEnabled !== undefined ? { isEnabled: body.isEnabled } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
        ...(body.stockMode !== undefined
          ? { stockMode: body.stockMode === 'PREDEFINED' ? 'PREDEFINED' : 'DYNAMIC' }
          : {}),
      },
    })

    await recordAdminOperationAuditLog(prisma, {
      adminUsername: authResult.payload?.username ?? 'unknown',
      operationType: 'SHOP_PRODUCT_UPDATED',
      targetLabel: product.name,
      detail: { productId: product.id },
    })

    return NextResponse.json({ success: true, product })
  },
  { logLabel: 'shop-product-update' },
)

export const DELETE = createProtectedAdminRouteHandler(
  async (request: NextRequest, authResult, { params }: { params: { id: string } }) => {
    const t = serverT(resolveServerLocale(request))
    const id = Number(params.id)
    const existing = await prisma.shopProduct.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ success: false, message: t('shop.productNotFound') }, { status: 404 })
    }

    // 有历史订单的商品不能删除（外键保护），给出明确提示而非 500
    const orderCount = await prisma.shopOrder.count({ where: { productId: id } })
    if (orderCount > 0) {
      return NextResponse.json(
        {
          success: false,
          message: t('shop.productHasOrders', { count: orderCount }),
        },
        { status: 409 },
      )
    }

    await prisma.shopProduct.delete({ where: { id } })

    await recordAdminOperationAuditLog(prisma, {
      adminUsername: authResult.payload?.username ?? 'unknown',
      operationType: 'SHOP_PRODUCT_DELETED',
      targetLabel: existing.name,
    })

    return NextResponse.json({ success: true })
  },
  { logLabel: 'shop-product-delete' },
)
