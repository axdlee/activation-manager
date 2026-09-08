import { NextResponse, type NextRequest } from 'next/server'

import { createProtectedAdminRouteHandler } from '@/lib/admin-route-handler'
import { prisma } from '@/lib/db'

export const GET = createProtectedAdminRouteHandler(async (request: NextRequest) => {
  const url = new URL(request.url)
  const status = url.searchParams.get('status') ?? undefined
  const provider = url.searchParams.get('provider') ?? undefined
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1))
  const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get('pageSize') ?? 20)))

  const where = {
    ...(status && status !== 'all' ? { status } : {}),
    ...(provider && provider !== 'all' ? { provider } : {}),
  }

  const [orders, total] = await Promise.all([
    prisma.shopOrder.findMany({
      where,
      include: { product: { select: { name: true, stockMode: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.shopOrder.count({ where }),
  ])

  return NextResponse.json({
    success: true,
    orders: orders.map((order) => ({
      id: order.id,
      orderNo: order.orderNo,
      productName: order.product.name,
      productStockMode: order.product.stockMode,
      quantity: order.quantity,
      amountInCents: order.amountInCents,
      status: order.status,
      provider: order.provider,
      contactEmail: order.contactEmail,
      contactPhone: order.contactPhone,
      contactWechat: order.contactWechat,
      paymentNote: order.paymentNote,
      paidAt: order.paidAt,
      fulfilledAt: order.fulfilledAt,
      createdAt: order.createdAt,
    })),
    pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
  })
}, { logLabel: 'shop-orders-list' })
