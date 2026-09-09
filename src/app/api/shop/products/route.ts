import { NextResponse, type NextRequest } from 'next/server'

import { isShopEnabled } from '@/lib/shop-access'

import { resolveServerLocale, serverT } from '@/lib/i18n/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// 公开商品列表：仅返回启用中的商品
// 支持排序：recommended（默认，sortOrder+id）| priceAsc | priceDesc | newest
// 预定义模式商品附带剩余库存（售罄前端展示）
export async function GET(request: NextRequest) {
  const t = serverT(resolveServerLocale(request))

  if (!(await isShopEnabled())) {
    return NextResponse.json({ success: false, message: t('shop.disabled') }, { status: 403 })
  }

  const sort = request.nextUrl.searchParams.get('sort') ?? 'recommended'

  let orderBy: object[]
  switch (sort) {
    case 'priceAsc':
      orderBy = [{ priceInCents: 'asc' as const }, { id: 'asc' as const }]
      break
    case 'priceDesc':
      orderBy = [{ priceInCents: 'desc' as const }, { id: 'asc' as const }]
      break
    case 'newest':
      orderBy = [{ createdAt: 'desc' as const }, { id: 'desc' as const }]
      break
    default:
      orderBy = [{ sortOrder: 'asc' as const }, { id: 'asc' as const }]
  }

  const products = await prisma.shopProduct.findMany({
    where: { isEnabled: true },
    include: {
      project: true,
      _count: {
        select: { stock: { where: { status: 'AVAILABLE' } } },
      },
    },
    orderBy,
  })

  return NextResponse.json({
    success: true,
    products: products.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      licenseMode: product.licenseMode,
      cardType: product.cardType,
      validDays: product.validDays,
      totalCount: product.totalCount,
      priceInCents: product.priceInCents,
      projectKey: product.project.projectKey,
      stockMode: product.stockMode,
      availableStock: product.stockMode === 'PREDEFINED' ? product._count.stock : null,
    })),
  })
}
