import { randomBytes } from 'node:crypto'

import { prisma } from './db'
import { recordAdminOperationAuditLog } from './admin-operation-audit-service'
import { getEnabledPaymentConfig } from './shop-payment-registry'
import { type ShopOrderInfo } from './shop-payment-types'
import { type ServerT } from './i18n/server'

/** 服务端消息词典 key（zh/en 由 route 注入 ServerT 翻译；未注入时回退中文原文） */
export const SHOP_ORDER_MESSAGE_KEYS = {
  quantityInvalid: 'shop.quantityInvalid',
  productDisabled: 'shop.productDisabled',
  contactRequired: 'shop.contactRequired',
  paymentProviderDisabled: 'shop.paymentProviderDisabled',
  productSoldOut: 'shop.productSoldOut',
  productInsufficientStock: 'shop.productInsufficientStock',
  orderNotFound: 'shop.orderNotFound',
  orderCancelled: 'shop.orderCancelled',
  orderStateConflict: 'shop.orderStateConflict',
  orderStateConflictFulfill: 'shop.orderStateConflictFulfill',
} as const

export const SHOP_ORDER_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  FULFILLED: 'fulfilled',
  CANCELLED: 'cancelled',
} as const

export type ShopOrderStatus = (typeof SHOP_ORDER_STATUS)[keyof typeof SHOP_ORDER_STATUS]

/** 单笔订单最大购买数量（与动态发码单次生成上限 100 对齐） */
export const SHOP_ORDER_MAX_QUANTITY = 100

export function normalizeShopOrderQuantity(value: unknown, t?: ServerT): number {
  const quantity = Number(value ?? 1)
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > SHOP_ORDER_MAX_QUANTITY) {
    throw new ShopOrderError(
      t?.(SHOP_ORDER_MESSAGE_KEYS.quantityInvalid) ??
        `购买数量必须是 1 到 ${SHOP_ORDER_MAX_QUANTITY} 之间的整数`,
      400,
    )
  }
  return quantity
}

export function generateShopOrderNo() {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = randomBytes(4).toString('hex').toUpperCase()
  return `SO${timestamp}${random}`
}

export type CreateShopOrderInput = {
  productId: number
  providerId: string
  quantity?: number
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

export async function createShopOrder(input: CreateShopOrderInput, t?: ServerT) {
  const quantity = normalizeShopOrderQuantity(input.quantity, t)

  const product = await prisma.shopProduct.findUnique({
    where: { id: input.productId },
  })

  if (!product || !product.isEnabled) {
    throw new ShopOrderError(t?.(SHOP_ORDER_MESSAGE_KEYS.productDisabled) ?? '商品不存在或已下架', 404)
  }

  if (!input.contactEmail && !input.contactPhone && !input.contactWechat) {
    throw new ShopOrderError(t?.(SHOP_ORDER_MESSAGE_KEYS.contactRequired) ?? '请至少提供邮箱、手机号或微信号中的一种联系方式，用于找回卡密', 400)
  }

  const paymentConfig = await getEnabledPaymentConfig(input.providerId)
  if (!paymentConfig) {
    throw new ShopOrderError(t?.(SHOP_ORDER_MESSAGE_KEYS.paymentProviderDisabled) ?? '支付渠道未启用', 400)
  }

  // 预定义码商品：下单时校验码池库存充足（数量 × 单价，售罄/库存不足直接拒绝，避免买家付款后才发现无货）
  if (product.stockMode === 'PREDEFINED') {
    const availableStock = await prisma.shopProductCodeStock.count({
      where: { productId: product.id, status: 'AVAILABLE' },
    })
    if (availableStock < quantity) {
      throw new ShopOrderError(
        availableStock <= 0
          ? t?.(SHOP_ORDER_MESSAGE_KEYS.productSoldOut) ?? '该商品已售罄，请等待补货'
          : t?.(SHOP_ORDER_MESSAGE_KEYS.productInsufficientStock, { stock: availableStock }) ??
            `该商品库存不足，剩余 ${availableStock} 张`,
        409,
      )
    }
  }

  const orderNo = generateShopOrderNo()
  const order = await prisma.shopOrder.create({
    data: {
      orderNo,
      productId: product.id,
      quantity,
      amountInCents: product.priceInCents * quantity,
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
}, t?: ServerT) {
  const { orderNo, transactionId, adminUsername } = params

  const order = await prisma.shopOrder.findUnique({ where: { orderNo } })
  if (!order) {
    return { success: false as const, message: t?.(SHOP_ORDER_MESSAGE_KEYS.orderNotFound) ?? '订单不存在' }
  }

  if (order.status === SHOP_ORDER_STATUS.FULFILLED || order.status === SHOP_ORDER_STATUS.PAID) {
    return { success: true as const, alreadyProcessed: true as const }
  }

  if (order.status === SHOP_ORDER_STATUS.CANCELLED) {
    return { success: false as const, message: t?.(SHOP_ORDER_MESSAGE_KEYS.orderCancelled) ?? '订单已取消' }
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
    return { success: false as const, message: t?.(SHOP_ORDER_MESSAGE_KEYS.orderStateConflict) ?? '订单状态已变化' }
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
