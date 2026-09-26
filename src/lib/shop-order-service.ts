import { randomBytes } from 'node:crypto'

import { type PrismaClient } from '@prisma/client'

import { prisma } from './db'
import { getEnabledPaymentConfig, getPaymentProvider } from './shop-payment-registry'
import {
  releaseExpiredShopStockReservations,
  resolveShopStockReservationTtlMs,
} from './shop-stock-reservation'
import { type ShopOrderInfo } from './shop-payment-types'
import { type ServerT } from './i18n/server'

/** 服务端消息词典 key（zh/en 由 route 注入 ServerT 翻译；未注入时回退中文原文） */
export const SHOP_ORDER_MESSAGE_KEYS = {
  quantityInvalid: 'shop.quantityInvalid',
  exceedsMaxQuantity: 'shop.exceedsMaxQuantity',
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
  tooManyPendingOrders: 'shop.tooManyPendingOrders',
} as const

export const SHOP_ORDER_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  FULFILLED: 'fulfilled',
  CANCELLED: 'cancelled',
} as const

export type ShopOrderStatus = (typeof SHOP_ORDER_STATUS)[keyof typeof SHOP_ORDER_STATUS]

/** 单笔订单购买数量硬上限（与动态发码单次生成上限 100 对齐） */
export const SHOP_ORDER_MAX_QUANTITY = 100

/** 单笔订单数量默认上限：缩小「单请求锁死全部库存」的爆炸半径 */
export const SHOP_ORDER_MAX_QUANTITY_DEFAULT = 10

export const SHOP_ORDER_MAX_QUANTITY_ENV = 'SHOP_ORDER_MAX_QUANTITY_PER_ORDER'

/**
 * 单笔订单数量上限：env 可配（1–100），缺省 10。
 * 防止单个未支付订单把码池库存全部预占。
 */
export function resolveShopOrderMaxQuantity(
  env: Record<string, string | undefined> = process.env,
): number {
  const raw = Number(env[SHOP_ORDER_MAX_QUANTITY_ENV])
  if (!Number.isFinite(raw) || raw < 1) {
    return SHOP_ORDER_MAX_QUANTITY_DEFAULT
  }
  return Math.min(Math.round(raw), SHOP_ORDER_MAX_QUANTITY)
}

/** 超出单笔数量上限的拒绝消息（缺省回退中文原文） */
function assertQuantityWithinPerOrderLimit(quantity: number, t?: ServerT) {
  const maxQuantity = resolveShopOrderMaxQuantity()
  if (quantity > maxQuantity) {
    throw new ShopOrderError(
      t?.(SHOP_ORDER_MESSAGE_KEYS.exceedsMaxQuantity, { max: maxQuantity }) ??
        `单笔订单最多购买 ${maxQuantity} 张`,
      400,
    )
  }
}

export const SHOP_MAX_PENDING_ORDERS_PER_CONTACT_ENV = 'SHOP_MAX_PENDING_ORDERS_PER_CONTACT'
export const SHOP_MAX_PENDING_ORDERS_PER_CONTACT_DEFAULT = 3
const SHOP_MAX_PENDING_ORDERS_PER_CONTACT_LIMIT = 100

export const SHOP_MAX_PENDING_ORDERS_PER_IP_ENV = 'SHOP_MAX_PENDING_ORDERS_PER_IP'
export const SHOP_MAX_PENDING_ORDERS_PER_IP_DEFAULT = 10
const SHOP_MAX_PENDING_ORDERS_PER_IP_LIMIT = 1000

/**
 * 同一联系方式待支付订单上限：env 可配（1–100），缺省 3。
 * 预占已有 TTL 过期，但攻击者仍可循环「锁满 → 等过期 → 再锁」；
 * 联系方式（邮箱/手机/微信任一命中）是找回卡密的唯一凭证，同一凭证
 * 的 pending 单数超额即拒绝。已支付/已取消/已履约订单不占额度。
 */
export function resolveShopMaxPendingOrdersPerContact(
  env: Record<string, string | undefined> = process.env,
): number {
  const raw = Number(env[SHOP_MAX_PENDING_ORDERS_PER_CONTACT_ENV])
  if (!Number.isFinite(raw) || raw < 1) {
    return SHOP_MAX_PENDING_ORDERS_PER_CONTACT_DEFAULT
  }
  return Math.min(Math.round(raw), SHOP_MAX_PENDING_ORDERS_PER_CONTACT_LIMIT)
}

/**
 * 同一下单 IP 待支付订单上限：env 可配（1–1000），缺省 10。
 * 防御换着联系方式刷单的行为；clientIp 取 server.js XFF 追加后的
 * 真实来源，伪造 X-Forwarded-For 已被追加挤位（同机反代修复）。
 */
export function resolveShopMaxPendingOrdersPerIp(
  env: Record<string, string | undefined> = process.env,
): number {
  const raw = Number(env[SHOP_MAX_PENDING_ORDERS_PER_IP_ENV])
  if (!Number.isFinite(raw) || raw < 1) {
    return SHOP_MAX_PENDING_ORDERS_PER_IP_DEFAULT
  }
  return Math.min(Math.round(raw), SHOP_MAX_PENDING_ORDERS_PER_IP_LIMIT)
}

/** 待支付订单频控：联系方式与 IP 两个维度并列，任一超额即 409 */
async function assertPendingOrderQuotaWithinLimit(
  input: Pick<CreateShopOrderInput, 'contactEmail' | 'contactPhone' | 'contactWechat' | 'clientIp'>,
  t?: ServerT,
) {
  const contactCondition = {
    status: SHOP_ORDER_STATUS.PENDING,
    OR: [
      ...(input.contactEmail ? [{ contactEmail: input.contactEmail }] : []),
      ...(input.contactPhone ? [{ contactPhone: input.contactPhone }] : []),
      ...(input.contactWechat ? [{ contactWechat: input.contactWechat }] : []),
    ],
  }
  const [pendingByContact, pendingByIp] = await Promise.all([
    contactCondition.OR.length > 0
      ? prisma.shopOrder.count({ where: contactCondition })
      : Promise.resolve(0),
    input.clientIp
      ? prisma.shopOrder.count({
          where: { status: SHOP_ORDER_STATUS.PENDING, clientIp: input.clientIp },
        })
      : Promise.resolve(0),
  ])

  const maxPerContact = resolveShopMaxPendingOrdersPerContact()
  if (pendingByContact >= maxPerContact) {
    throw new ShopOrderError(
      t?.(SHOP_ORDER_MESSAGE_KEYS.tooManyPendingOrders, { max: maxPerContact }) ??
        `待支付订单过多（上限 ${maxPerContact} 笔），请先完成支付或等待订单过期`,
      409,
    )
  }

  const maxPerIp = resolveShopMaxPendingOrdersPerIp()
  if (pendingByIp >= maxPerIp) {
    throw new ShopOrderError(
      t?.(SHOP_ORDER_MESSAGE_KEYS.tooManyPendingOrders, { max: maxPerIp }) ??
        `待支付订单过多（上限 ${maxPerIp} 笔），请先完成支付或等待订单过期`,
      409,
    )
  }
}

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

export type AdminCancelShopOrderResult = {
  releasedStockCount: number
}

/**
 * 管理员取消未支付订单：仅 pending 可取消（事务内条件更新防并发，
 * 与支付回调/确认发卡抢状态）。成功时同步释放该订单的 RESERVED
 * 预占库存（不等 TTL），码立即回可售。
 * 非法状态（已支付/已发卡/已取消）抛 409。
 */
export async function cancelShopOrderByAdmin(
  orderNo: string,
  client: PrismaClient = prisma,
): Promise<AdminCancelShopOrderResult> {
  const order = await client.shopOrder.findUnique({
    where: { orderNo },
    select: { id: true, status: true },
  })

  if (!order) {
    throw new ShopOrderError('订单不存在', 404)
  }
  if (order.status !== SHOP_ORDER_STATUS.PENDING) {
    throw new ShopOrderError('仅待支付订单可取消', 409)
  }

  return client.$transaction(async (tx) => {
    const cancelled = await tx.shopOrder.updateMany({
      where: { id: order.id, status: SHOP_ORDER_STATUS.PENDING },
      data: { status: SHOP_ORDER_STATUS.CANCELLED },
    })
    if (cancelled.count === 0) {
      throw new ShopOrderError('订单状态已变化，请刷新后重试', 409)
    }

    const released = await tx.shopProductCodeStock.updateMany({
      where: { soldOrderId: order.id, status: 'RESERVED' },
      data: { status: 'AVAILABLE', soldOrderId: null, reservedUntil: null },
    })
    return { releasedStockCount: released.count }
  })
}

export type CreateShopOrderInput = {
  productId: number
  providerId: string
  quantity?: number
  contactEmail?: string
  contactPhone?: string
  contactWechat?: string
  clientIp?: string
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
  assertQuantityWithinPerOrderLimit(quantity, t)

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

  // 占位渠道（验签未实现的适配器）即使后台误启用也不允许下单，
  // 防止绕过前台渠道过滤直调 API 生成永远无法支付的订单
  const providerDefinition = getPaymentProvider(input.providerId)
  if (providerDefinition?.callbackTrust === 'placeholder') {
    throw new ShopOrderError(t?.(SHOP_ORDER_MESSAGE_KEYS.paymentProviderDisabled) ?? '支付渠道未启用', 400)
  }

  const paymentConfig = await getEnabledPaymentConfig(input.providerId)
  if (!paymentConfig) {
    throw new ShopOrderError(t?.(SHOP_ORDER_MESSAGE_KEYS.paymentProviderDisabled) ?? '支付渠道未启用', 400)
  }

  // 待支付订单频控：联系方式/IP 维度超额直接拒绝（联系方式先 trim 规范化，
  // 与落库值一致），防止「锁满库存 → 等过期 → 再锁」的循环轰炸
  await assertPendingOrderQuotaWithinLimit(
    {
      contactEmail: input.contactEmail?.trim(),
      contactPhone: input.contactPhone?.trim(),
      contactWechat: input.contactWechat?.trim(),
      clientIp: input.clientIp?.trim(),
    },
    t,
  )

  // 预定义码商品：事务内「校验库存 + 创建订单 + 预占码池库存」。
  // 预占（AVAILABLE → RESERVED）保证超卖防线名副其实：只剩 1 张码时
  // 第二笔订单会因抢不到预占而失败，而不是两单都成功、付款后才撞售罄。
  if (product.stockMode === 'PREDEFINED') {
    const orderNo = generateShopOrderNo()
    const order = await prisma.$transaction(async (tx) => {
      // 先释放过期预占：码池不被历史未支付订单的预占长期虚锁
      await releaseExpiredShopStockReservations(Date.now(), tx)

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
          clientIp: input.clientIp?.trim() || null,
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
            reservedUntil: new Date(Date.now() + resolveShopStockReservationTtlMs()),
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
      clientIp: input.clientIp?.trim() || null,
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
