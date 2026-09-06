import { NextResponse, type NextRequest } from 'next/server'

import { createProtectedAdminRouteHandler } from '@/lib/admin-route-handler'
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
}

export const PATCH = createProtectedAdminRouteHandler(
  async (request: NextRequest, authResult, { params }: { params: { id: string } }) => {
    const id = Number(params.id)
    const existing = await prisma.shopProduct.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ success: false, message: '商品不存在' }, { status: 404 })
    }

    const body = (await request.json()) as UpdateProductBody

    if (body.priceInCents !== undefined && body.priceInCents < 0) {
      return NextResponse.json({ success: false, message: '价格不能为负' }, { status: 400 })
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
        ...(body.priceInCents !== undefined ? { priceInCents: Math.round(body.priceInCents) } : {}),
        ...(body.isEnabled !== undefined ? { isEnabled: body.isEnabled } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
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
  async (_request: NextRequest, authResult, { params }: { params: { id: string } }) => {
    const id = Number(params.id)
    const existing = await prisma.shopProduct.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ success: false, message: '商品不存在' }, { status: 404 })
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
