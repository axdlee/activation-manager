import { randomBytes } from 'node:crypto'

import { prisma } from './db'
import { getEnabledPaymentConfig } from './shop-payment-registry'
import { type ShopOrderInfo } from './shop-payment-types'
import { type ServerT } from './i18n/server'

/** 服务端消息词典 key（zh/en 由 route 注入 ServerT 翻译；未注入时回退中文原文） */
export const SHOP_ORDER_MESSAGE_KEYS = {
  quantityInvalid: 'shop.quantityInvalid',
  productDisabled: 'shop.productDisabled',
  contactRequired: 'shop.contactRequired',
  invalidEmail: 'shop.invalidEmail',
  invalidPhone: 'shop.invalidPhone',
  invalidWechat: 'shop.invalidWechat',
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

/** 订单详情查询令牌：下单时生成，查询已发卡密必须携带，防订单号枚举 */
export function generateShopOrderAccessToken() {
  return randomBytes(16).toString('hex')
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

  // 联系方式规范化校验：格式错误的邮箱/超长字段会产生无法触达的订单
  const email = input.contactEmail?.trim() ?? ''
  if (email) {
    const isWellFormedEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254
    if (!isWellFormedEmail) {
      throw new ShopOrderError(t?.(SHOP_ORDER_MESSAGE_KEYS.invalidEmail) ?? '联系邮箱格式不正确', 400)
    }
  }
  if (input.contactPhone && input.contactPhone.trim().length > 32) {
    throw new ShopOrderError(t?.(SHOP_ORDER_MESSAGE_KEYS.invalidPhone) ?? '手机号格式不正确', 400)
  }
  if (input.contactWechat && input.contactWechat.trim().length > 64) {
    throw new ShopOrderError(t?.(SHOP_ORDER_MESSAGE_KEYS.invalidWechat) ?? '微信号格式不正确', 400)
  }

  const paymentConfig = await getEnabledPaymentConfig(input.providerId)
  if (!paymentConfig) {
    throw new ShopOrderError(t?.(SHOP_ORDER_MESSAGE_KEYS.paymentProviderDisabled) ?? '支付渠道未启用', 400)
  }

  // 预定义码商品：事务内「校验库存 + 创建订单 + 预占码池库存」。
  // 预占（AVAILABLE → RESERVED）保证超卖防线名副其实：只剩 1 张码时
  // 第二笔订单会因抢不到预占而失败，而不是两单都成功、付款后才撞售罄。
  if (product.stockMode === 'PREDEFINED') {
    const orderNo = generateShopOrderNo()
    const order = await prisma.$transaction(async (tx) => {
      const availableStock = await tx.shopProductCodeStock.findMany({
        where: { productId: product.id, status: 'AVAILABLE' },
        orderBy: { id: 'asc' },
      })

      // 跳过悬空库存（激活码已被删除的行），凑满 quantity 张可预占库存
      let usableCount = 0
      for (const stock of availableStock) {
        if (usableCount >= quantity) {
          break
        }
        const activationCode = await tx.activationCode.findFirst({
          where: { id: stock.activationCodeId, deletedAt: null },
          select: { id: true },
        })
        if (activationCode) {
          usableCount += 1
        }
      }

      if (usableCount < quantity) {
        throw new ShopOrderError(
          usableCount <= 0
            ? t?.(SHOP_ORDER_MESSAGE_KEYS.productSoldOut) ?? '该商品已售罄，请等待补货'
            : t?.(SHOP_ORDER_MESSAGE_KEYS.productInsufficientStock, { stock: usableCount }) ??
              `该商品库存不足，剩余 ${usableCount} 张`,
          409,
        )
      }

      const created = await tx.shopOrder.create({
        data: {
          orderNo,
          accessToken: generateShopOrderAccessToken(),
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

      // 逐行原子预占（条件更新防并发抢占同一行）；失败抛错整体回滚
      let reserved = 0
      for (const stock of availableStock) {
        if (reserved >= quantity) {
          break
        }
        const claimed = await tx.shopProductCodeStock.updateMany({
          where: { id: stock.id, status: 'AVAILABLE' },
          data: {
            status: 'RESERVED',
            soldOrderId: created.id,
          },
        })
        if (claimed.count === 1) {
          reserved += 1
        }
      }

      if (reserved < quantity) {
        throw new ShopOrderError(
          t?.(SHOP_ORDER_MESSAGE_KEYS.productInsufficientStock, { stock: reserved }) ??
            `该商品库存不足，剩余 ${reserved} 张`,
          409,
        )
      }

      return created
    })

    return {
      order,
      product,
    }
  }

  const orderNo = generateShopOrderNo()
  const order = await prisma.shopOrder.create({
    data: {
      orderNo,
      accessToken: generateShopOrderAccessToken(),
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
