import { prisma } from './db'
import { notifyShopOrderTimeoutCancelledEvent } from './notification-events'
import { SHOP_ORDER_STATUS } from './shop-order-service'

export const SHOP_ORDER_PENDING_TIMEOUT_MS = 30 * 60 * 1000 // 30 分钟

/**
 * 清理超时未支付的待支付订单。
 * 自动渠道（yipay/webhook 等）的 pending 订单超过 30 分钟未支付 →
 * 标记 cancelled（幂等，可重复触发）。
 * manual（人工收款）渠道不自动取消：这类订单本就依赖管理员人工确认，
 * 自动取消会造成「31 分钟后管理员来确认，订单已被取消」的冲突；
 * 它们由管理员主动确认或手动取消。
 * 清理结果通过通用通知系统分发（配置了通知渠道才有动作）。
 * 供后台按钮 / 外部 cron 调用。
 */
export async function cancelExpiredPendingOrders(now: number = Date.now()) {
  const cutoff = new Date(now - SHOP_ORDER_PENDING_TIMEOUT_MS)

  const expiredOrders = await prisma.shopOrder.findMany({
    where: {
      status: SHOP_ORDER_STATUS.PENDING,
      createdAt: { lt: cutoff },
      // 人工收款订单不超时取消
      provider: { not: 'manual' },
    },
    select: { id: true, orderNo: true },
    orderBy: { id: 'asc' },
  })

  if (expiredOrders.length === 0) {
    return { cancelled: 0 }
  }

  const result = await prisma.$transaction(async (tx) => {
    const updateResult = await tx.shopOrder.updateMany({
      where: {
        status: SHOP_ORDER_STATUS.PENDING,
        orderNo: { in: expiredOrders.map((order) => order.orderNo) },
      },
      data: {
        status: SHOP_ORDER_STATUS.CANCELLED,
      },
    })

    // 释放这些订单在下单时预占的码池库存，让码回到可售状态
    await tx.shopProductCodeStock.updateMany({
      where: {
        soldOrderId: { in: expiredOrders.map((order) => order.id) },
        status: 'RESERVED',
      },
      data: {
        status: 'AVAILABLE',
        soldOrderId: null,
      },
    })

    return updateResult
  })

  // 管理员通知：本次取消的订单号列表（渠道未配置时内部自动跳过）
  notifyShopOrderTimeoutCancelledEvent({
    orderNos: expiredOrders.map((order) => order.orderNo),
    timeoutMinutes: SHOP_ORDER_PENDING_TIMEOUT_MS / 60 / 1000,
  })

  return { cancelled: result.count }
}