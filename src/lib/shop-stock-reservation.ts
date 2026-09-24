import { prisma } from './db'

/** 预占默认有效时长：60 分钟（默认支付窗口 30 分钟的 2 倍，宁可偏长防误释放） */
export const SHOP_STOCK_RESERVATION_DEFAULT_TTL_MS = 60 * 60 * 1000

export const SHOP_STOCK_RESERVATION_TTL_ENV = 'SHOP_STOCK_RESERVATION_TTL_MINUTES'

/** 预占时长上下限：1 分钟 – 24 小时 */
const SHOP_STOCK_RESERVATION_TTL_MIN_MS = 60 * 1000
const SHOP_STOCK_RESERVATION_TTL_MAX_MS = 24 * 60 * 60 * 1000

/**
 * 解析预占过期时长（env 指定分钟数，缺省 60 分钟）。
 * 非法值一律回退默认，不抛错（下单主流程不应被配置失误打断）。
 */
export function resolveShopStockReservationTtlMs(
  env: Record<string, string | undefined> = process.env,
): number {
  const raw = Number(env[SHOP_STOCK_RESERVATION_TTL_ENV])
  if (!Number.isFinite(raw) || raw <= 0) {
    return SHOP_STOCK_RESERVATION_DEFAULT_TTL_MS
  }
  const ttlMs = Math.round(raw * 60 * 1000)
  return Math.min(Math.max(ttlMs, SHOP_STOCK_RESERVATION_TTL_MIN_MS), SHOP_STOCK_RESERVATION_TTL_MAX_MS)
}

/** 最小结构类型：兼容 prisma / 事务客户端 / 测试替身 */
export type StockReservationClient = {
  shopProductCodeStock: {
    updateMany: (args: {
      where: { status: string; reservedUntil: { lt: Date } }
      data: { status: string; soldOrderId: null; reservedUntil: null }
    }) => Promise<{ count: number }>
  }
}

/**
 * 释放已过期的 RESERVED 预占行（回 AVAILABLE、摘除 soldOrderId 与 reservedUntil）。
 *
 * 预占过期与订单状态解耦：订单可能仍是 pending（人工收款不自动取消），
 * 但码池库存不能被单个未支付订单永久锁死。管理员确认收款时，
 * 发卡流程会先释放过期预占，再从可用库存重新抢占（同单原行优先）。
 */
export async function releaseExpiredShopStockReservations(
  now: number = Date.now(),
  client: StockReservationClient = prisma,
): Promise<number> {
  const result = await client.shopProductCodeStock.updateMany({
    where: { status: 'RESERVED', reservedUntil: { lt: new Date(now) } },
    data: { status: 'AVAILABLE', soldOrderId: null, reservedUntil: null },
  })
  return result.count
}
