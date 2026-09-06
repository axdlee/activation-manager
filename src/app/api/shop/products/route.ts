import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// 公开商品列表：仅返回启用中的商品
export async function GET() {
  const products = await prisma.shopProduct.findMany({
    where: { isEnabled: true },
    include: { project: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
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
    })),
  })
}
