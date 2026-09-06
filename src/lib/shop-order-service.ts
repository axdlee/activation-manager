import { randomBytes } from 'node:crypto'

import { prisma } from './db'
import { recordAdminOperationAuditLog } from './admin-operation-audit-service'
import { getEnabledPaymentConfig } from './shop-payment-registry'
import { type ShopOrderInfo } from './shop-payment-types'

export const SHOP_ORDER_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  FULFILLED: 'fulfilled',
  CANCELLED: 'cancelled',
} as const

export type ShopOrderStatus = (typeof SHOP_ORDER_STATUS)[keyof typeof SHOP_ORDER_STATUS]

export function generateShopOrderNo() {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = randomBytes(4).toString('hex').toUpperCase()
  return `SO${timestamp}${random}`
}

export type CreateShopOrderInput = {
  productId: number
  providerId: string
  contactEmail?: string
  contactPhone?: string
  contactWechat?: string
  paymentNote?: string
  remark?: string
}

export class ShopOrderError extends Error {
  constructor(
    message: string,
    readonly statusCode = 400,
  ) {
    super(message)
    this.name = 'ShopOrderError'
  }
}

export async function createShopOrder(input: CreateShopOrderInput) {
  const product = await prisma.shopProduct.findUnique({
    where: { id: input.productId },
  })

  if (!product || !product.isEnabled) {
    throw new ShopOrderError('商品不存在或已下架', 404)
  }

  if (!input.contactEmail && !input.contactPhone && !input.contactWechat) {
    throw new ShopOrderError('请至少提供邮箱、手机号或微信号中的一种联系方式，用于找回卡密', 400)
  }

  const paymentConfig = await getEnabledPaymentConfig(input.providerId)
  if (!paymentConfig) {
    throw new ShopOrderError('支付渠道未启用', 400)
  }

  const orderNo = generateShopOrderNo()
  const order = await prisma.shopOrder.create({
    data: {
      orderNo,
      productId: product.id,
      amountInCents: product.priceInCents,
      contactEmail: input.contactEmail?.trim() || null,
      contactPhone: input.contactPhone?.trim() || null,
      contactWechat: input.contactWechat?.trim() || null,
      status: SHOP_ORDER_STATUS.PENDING,
      provider: input.providerId,
      paymentNote: input.paymentNote?.trim() || null,
      remark: input.remark?.trim() || null,
    },
  })

  return {
    order,
    product,
  }
}

/**
 * 标记订单已支付（幂等：已支付/已发卡返回 alreadyProcessed）。
 * 供支付回调 / 后台确认调用。
 */
export async function markShopOrderPaid(params: {
  orderNo: string
  transactionId?: string
  adminUsername?: string
}) {
  const { orderNo, transactionId, adminUsername } = params

  const order = await prisma.shopOrder.findUnique({ where: { orderNo } })
  if (!order) {
    return { success: false as const, message: '订单不存在' }
  }

  if (order.status === SHOP_ORDER_STATUS.FULFILLED || order.status === SHOP_ORDER_STATUS.PAID) {
    return { success: true as const, alreadyProcessed: true as const }
  }

  if (order.status === SHOP_ORDER_STATUS.CANCELLED) {
    return { success: false as const, message: '订单已取消' }
  }

  // 原子条件更新：仅当仍为 pending 时才标记已支付，避免并发重复处理
  const updateResult = await prisma.shopOrder.updateMany({
    where: {
      id: order.id,
      status: SHOP_ORDER_STATUS.PENDING,
    },
    data: {
      status: SHOP_ORDER_STATUS.PAID,
      paidAt: new Date(),
      paymentNote: transactionId ?? order.paymentNote,
    },
  })

  if (updateResult.count === 0) {
    // 并发下状态已被其他请求改变
    const latest = await prisma.shopOrder.findUnique({ where: { id: order.id } })
    if (latest?.status === SHOP_ORDER_STATUS.FULFILLED || latest?.status === SHOP_ORDER_STATUS.PAID) {
      return { success: true as const, alreadyProcessed: true as const }
    }
    return { success: false as const, message: '订单状态已变化' }
  }

  if (adminUsername) {
    await recordAdminOperationAuditLog(prisma, {
      adminUsername,
      operationType: 'SHOP_ORDER_MARKED_PAID',
      targetLabel: orderNo,
      detail: { amountInCents: order.amountInCents },
    })
  }

  return { success: true as const }
}

export function buildShopOrderInfo(order: {
  orderNo: string
  amountInCents: number
  contactEmail: string | null
  contactPhone: string | null
  contactWechat: string | null
  product: { name: string }
}): ShopOrderInfo {
  return {
    orderNo: order.orderNo,
    amountInCents: order.amountInCents,
    productName: order.product.name,
    contactEmail: order.contactEmail,
    contactPhone: order.contactPhone,
    contactWechat: order.contactWechat,
  }
}
