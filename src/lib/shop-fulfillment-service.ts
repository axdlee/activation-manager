import { prisma } from './db'
import type { PrismaClient } from '@prisma/client'
import { generateActivationCodes } from './license-generation-service'
import {
  notifyShopOrderFulfilledEvent,
  sendBuyerOrderFulfilledEmail,
} from './notification-events'
import { SHOP_ORDER_STATUS, SHOP_ORDER_MESSAGE_KEYS } from './shop-order-service'
import { releaseExpiredShopStockReservations } from './shop-stock-reservation'
import { type ServerT } from './i18n/server'

/**
 * 自动发卡服务：支付成功后事务性发码并关联订单。
 * 参考发卡系统「支付即发货」闭环：
 * 订单 pending/paid → 事务内原子抢占为 fulfilled → 生成卡密 → 关联订单。
 *
 * 并发安全：两个并发确认/回调请求同时到达时，只有一个能通过
 * 「pending/paid → fulfilled」的条件更新（compare-and-swap）抢占成功，
 * 另一个 count=0 走已处理分支，绝不会重复发卡。
 */

export type FulfillShopOrderParams = {
  orderNo: string
  transactionId?: string
  adminUsername?: string
  /** 回调声称的支付渠道：发卡前与订单 payment provider 核对，不一致拒绝 */
  expectedProvider?: string
  /** 回调声称的实付金额（分）：提供时与订单金额核对，不一致拒绝 */
  expectedAmountInCents?: number
}

export type FulfillShopOrderResult = {
  success: boolean
  alreadyProcessed?: boolean
  message?: string
  codes?: string[]
}

export async function fulfillShopOrder(
  params: FulfillShopOrderParams,
  t?: ServerT,
  /** 可注入独立 PrismaClient（集成测试用临时库）；缺省用全局实例 */
  prismaClient: PrismaClient = prisma,
): Promise<FulfillShopOrderResult> {
  const order = await prismaClient.shopOrder.findUnique({
    where: { orderNo: params.orderNo },
    include: { product: { include: { project: true } } },
  })

  if (!order) {
    return { success: false, message: t?.(SHOP_ORDER_MESSAGE_KEYS.orderNotFound) ?? '订单不存在' }
  }

  // 渠道一致性：回调渠道必须与下单时选择的渠道一致，防止拿 A 渠道订单
  // 用 B 渠道伪造回调发卡
  if (params.expectedProvider && order.provider !== params.expectedProvider) {
    return { success: false, message: '回调渠道与订单支付渠道不一致，已拒绝发卡' }
  }

  // 金额一致性：渠道侧实付金额与订单金额不一致时拒绝发卡（防篡改/部分支付）
  if (
    params.expectedAmountInCents !== undefined &&
    params.expectedAmountInCents !== order.amountInCents
  ) {
    return { success: false, message: '回调金额与订单金额不一致，已拒绝发卡' }
  }

  if (order.status === SHOP_ORDER_STATUS.CANCELLED) {
    return { success: false, message: t?.(SHOP_ORDER_MESSAGE_KEYS.orderCancelled) ?? '订单已取消' }
  }

  if (order.status === SHOP_ORDER_STATUS.FULFILLED) {
    return {
      success: true,
      alreadyProcessed: true,
      codes: await readFulfilledCodes(prismaClient, order.fulfilledCodeIds),
    }
  }

  // 动态生成模式：事务外预生成激活码。码唯一键冲突的重试依赖自动提交
  // （PostgreSQL 事务出错即中止，事务内重试会失败）；生成失败时订单
  // 状态未被改动，可安全重试。
  const dynamicGenerated = order.product?.stockMode === 'DYNAMIC'
    ? await generateActivationCodes(prismaClient, {
      projectKey: order.product.project.projectKey,
      amount: Math.max(1, order.quantity ?? 1),
      licenseMode: order.product.licenseMode as 'TIME' | 'COUNT',
      validDays: order.product.validDays ?? null,
      totalCount: order.product.totalCount ?? null,
      cardType: order.product.cardType ?? null,
    })
    : null

  // 预生成的码未被本单采用时回收（支付网关重复回调/并发抢码场景下，
  // 输掉的请求生成的码不能留成有效但无主的孤儿码）
  const reclaimOrphanDynamicCodes = async () => {
    if (!dynamicGenerated || dynamicGenerated.length === 0) {
      return 0
    }
    // 仅删仍未使用的码：被并发赢家挂到订单上的码不受影响
    return prismaClient.activationCode.deleteMany({
      where: { id: { in: dynamicGenerated.map((code) => code.id) }, isUsed: false },
    }).then((result) => result.count)
  }

  // 事务内原子抢占：只有 pending/paid → fulfilled 转换成功的请求才发卡
  // 码池售罄/并发抢码冲突时返回业务失败（事务回滚，订单回到原状态）
  try {
    const txResult = await prismaClient.$transaction(
      async (
        tx,
      ): Promise<FulfillShopOrderResult & { newlyFulfilled?: boolean }> => {
      const claimed = await tx.shopOrder.updateMany({
        where: {
          id: order.id,
          status: {
            in: [SHOP_ORDER_STATUS.PENDING, SHOP_ORDER_STATUS.PAID],
          },
      },
      data: {
        status: SHOP_ORDER_STATUS.FULFILLED,
        paidAt: order.paidAt ?? new Date(),
        fulfilledAt: new Date(),
        ...(params.transactionId
          ? { paymentNote: params.transactionId }
          : order.paymentNote
            ? { paymentNote: order.paymentNote }
            : {}),
      },
    })

    // 并发抢占失败：另一请求已处理（或状态已变），返回已处理
    if (claimed.count === 0) {
      const latest = await tx.shopOrder.findUnique({ where: { id: order.id } })
      if (latest?.status === SHOP_ORDER_STATUS.FULFILLED) {
        return {
          success: true,
          alreadyProcessed: true,
          codes: await readFulfilledCodes(prismaClient, latest.fulfilledCodeIds),
        }
      }
      return { success: false, message: t?.(SHOP_ORDER_MESSAGE_KEYS.orderStateConflictFulfill) ?? '订单状态已变化，无法发卡' }
    }

    // 抢占成功：按商品发卡模式与订单数量发卡（失败则整个事务回滚，订单保持原状态）
    const product = order.product
    const quantity = Math.max(1, order.quantity ?? 1)
    let codeRecords: Array<{ id: number; code: string }>

    if (product.stockMode === 'PREDEFINED') {
      // 预定义码池发卡。下单时库存已预占（RESERVED + soldOrderId）：
      // 优先取本单预占的行；存量订单（预占机制上线前创建）没有预占行，
      // 回退到按 AVAILABLE 抢占。
      // 先释放过期预占（含本单过期行）：行回 AVAILABLE 后仍可被下方补偿抢占，
      // 避免其他订单的过期预占把补货来源虚锁。
      await releaseExpiredShopStockReservations(Date.now(), tx)
      const claimedStocks: Array<{
        stockId: number
        activationCode: { id: number; code: string }
        fromReserved: boolean
      }> = []

      const reservedStocks = await tx.shopProductCodeStock.findMany({
        where: { productId: product.id, soldOrderId: order.id, status: 'RESERVED' },
        orderBy: { id: 'asc' },
      })
      for (const stock of reservedStocks) {
        if (claimedStocks.length >= quantity) {
          break
        }
        // 软删除（deletedAt 非空）视同悬空：不可发卡
        const activationCode = await tx.activationCode.findFirst({
          where: { id: stock.activationCodeId, deletedAt: null },
          select: { id: true, code: true },
        })
        if (!activationCode) {
          // 预占行悬空（激活码被删）：释放预占并跳过
          await tx.shopProductCodeStock
            .updateMany({
              where: { id: stock.id, status: 'RESERVED' },
              data: { status: 'AVAILABLE', soldOrderId: null },
            })
            .catch(() => undefined)
          continue
        }
        claimedStocks.push({ stockId: stock.id, activationCode, fromReserved: true })
      }

      if (claimedStocks.length < quantity) {
        // 预占不足（旧订单或悬空释放）：从 AVAILABLE 补足，跳过悬空行
        const availableStocks = await tx.shopProductCodeStock.findMany({
          where: { productId: product.id, status: 'AVAILABLE' },
          orderBy: { id: 'asc' },
        })
        for (const stock of availableStocks) {
          if (claimedStocks.length >= quantity) {
            break
          }
          if (claimedStocks.some((claimed) => claimed.stockId === stock.id)) {
            continue
          }
          // 软删除（deletedAt 非空）视同悬空：不可发卡
          const activationCode = await tx.activationCode.findFirst({
            where: { id: stock.activationCodeId, deletedAt: null },
            select: { id: true, code: true },
          })
          if (!activationCode) {
            // 库存表对激活码没有外键：悬空行顺带清理，避免之后每单都撞上
            await tx.shopProductCodeStock
              .delete({ where: { id: stock.id } })
              .catch(() => undefined)
            continue
          }
          claimedStocks.push({ stockId: stock.id, activationCode, fromReserved: false })
        }
      }

      if (claimedStocks.length < quantity) {
        // 码池库存不足：抛错回滚订单
        throw new Error('SHOP_OUT_OF_STOCK')
      }

      codeRecords = []
      for (const candidate of claimedStocks) {
        const stockClaimed = await tx.shopProductCodeStock.updateMany({
          where: {
            id: candidate.stockId,
            status: candidate.fromReserved ? 'RESERVED' : 'AVAILABLE',
          },
          data: {
            status: 'SOLD',
            soldOrderId: order.id,
            soldAt: new Date(),
            reservedUntil: null,
          },
        })

        if (stockClaimed.count === 0) {
          // 并发下该码已被抢：抛错回滚，订单保持原状态由调用方重试
          throw new Error('SHOP_STOCK_RACE')
        }

        codeRecords.push(candidate.activationCode)
      }
    } else {
      // 动态生成：使用事务外预生成的激活码（见事务前的 dynamicGenerated）
      codeRecords = dynamicGenerated ?? []
    }

    const codes = codeRecords.map((code) => code.code)
    const fulfilledCodeIds = JSON.stringify(codeRecords.map((code) => code.id))

    await tx.shopOrder.update({
      where: { id: order.id },
      data: { fulfilledCodeIds },
    })

    return { success: true, codes, newlyFulfilled: true }
    })

    // 并发失败/状态冲突/异常路径：回收本次预生成的孤儿码（best-effort）
    if (txResult.success && txResult.newlyFulfilled) {
      // 发卡成功：预生成的码已挂到订单上，不回收
    } else {
      await reclaimOrphanDynamicCodes().catch(() => undefined)
    }

    // 事务提交成功后分发事件通知（fire-and-forget，不影响发卡结果）
    if (txResult.success && !txResult.alreadyProcessed && txResult.codes?.length) {
      dispatchFulfillmentNotifications({
        orderNo: order.orderNo,
        productName: order.product.name,
        amountInCents: order.amountInCents,
        contactEmail: order.contactEmail,
        codes: txResult.codes,
        trigger: params.adminUsername ? 'admin' : 'payment',
      })
    }

    return txResult
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('SHOP_')) {
      await reclaimOrphanDynamicCodes().catch(() => undefined)
      return {
        success: false,
        message:
          error.message === 'SHOP_OUT_OF_STOCK'
            ? t?.('shop.productSoldOut') ?? '商品已售罄'
            : t?.('payment.fulfillConflict') ?? '库存变更冲突，请重试',
      }
    }
    // 非业务异常同样回收预生成码后再上抛（事务已回滚，码必为孤儿）
    await reclaimOrphanDynamicCodes().catch(() => undefined)
    throw error
  }
}

/**
 * 发卡成功后的事件通知（fire-and-forget，不阻塞发卡主流程）：
 * - 管理员渠道（webhook/邮件/短信）：SHOP_ORDER_PAID_FULFILLED 事件
 * - 买家渠道：下单时留了邮箱则发送卡密邮件（需邮件通知已配置）
 */
function dispatchFulfillmentNotifications(params: {
  orderNo: string
  productName: string
  amountInCents: number
  contactEmail: string | null
  codes: string[]
  trigger: 'payment' | 'admin'
}) {
  notifyShopOrderFulfilledEvent({
    orderNo: params.orderNo,
    productName: params.productName,
    amountInCents: params.amountInCents,
    codes: params.codes,
    trigger: params.trigger,
  })

  if (params.contactEmail?.trim()) {
    void sendBuyerOrderFulfilledEmail({
      to: params.contactEmail,
      orderNo: params.orderNo,
      productName: params.productName,
      amountInCents: params.amountInCents,
      codes: params.codes,
    }).catch((error) => {
      console.warn(
        `[notify] 买家发卡邮件发送失败（${params.orderNo}）:`,
        error instanceof Error ? error.message : String(error),
      )
    })
  }
}

async function readFulfilledCodes(
  client: PrismaClient,
  fulfilledCodeIds: string | null,
): Promise<string[] | undefined> {
  const ids = parseFulfilledCodeIds(fulfilledCodeIds)
  if (ids.length === 0) {
    return undefined
  }
  const codes = await client.activationCode.findMany({
    where: { id: { in: ids } },
    orderBy: { id: 'asc' },
    select: { code: true },
  })
  return codes.map((code) => code.code)
}

function parseFulfilledCodeIds(fulfilledCodeIds: string | null): number[] {
  if (!fulfilledCodeIds) {
    return []
  }
  try {
    const parsed = JSON.parse(fulfilledCodeIds) as unknown
    return Array.isArray(parsed)
      ? parsed.filter((item): item is number => typeof item === 'number')
      : []
  } catch {
    return []
  }
}
