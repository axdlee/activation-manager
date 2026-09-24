import { prisma } from './db'
import type { PrismaClient } from '@prisma/client'
import { generateActivationCodes } from './license-generation-service'
import {
  notifyShopOrderFulfilledEvent,
  sendBuyerOrderFulfilledEmail,
} from './notification-events'
import { SHOP_ORDER_STATUS, SHOP_ORDER_MESSAGE_KEYS } from './shop-order-service'
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
      // 预定义码池：原子取 quantity 张 AVAILABLE 码（条件更新防并发超卖）
      const availableStocks = await tx.shopProductCodeStock.findMany({
        where: { productId: product.id, status: 'AVAILABLE' },
        orderBy: { id: 'asc' },
      })

      // 过滤悬空库存：库存表对激活码没有外键，管理员删除激活码后会留下
      // 悬空行；按 id 顺序取码会永远先撞上它们，让之后的每一单都发卡
      // 失败（支付回调场景即「已付款但接口 500」）。这里跳过悬空行并
      // 顺带清理，直到凑满 quantity 或码池见底。
      const candidates: Array<{
        stockId: number
        activationCode: { id: number; code: string }
      }> = []
      for (const stock of availableStocks) {
        if (candidates.length >= quantity) {
          break
        }
        const activationCode = await tx.activationCode.findUnique({
          where: { id: stock.activationCodeId },
          select: { id: true, code: true },
        })
        if (!activationCode) {
          await tx.shopProductCodeStock
            .delete({ where: { id: stock.id } })
            .catch(() => undefined)
          continue
        }
        candidates.push({ stockId: stock.id, activationCode })
      }

      if (candidates.length < quantity) {
        // 码池库存不足：抛错回滚订单
        throw new Error('SHOP_OUT_OF_STOCK')
      }

      codeRecords = []
      for (const candidate of candidates) {
        const stockClaimed = await tx.shopProductCodeStock.updateMany({
          where: { id: candidate.stockId, status: 'AVAILABLE' },
          data: {
            status: 'SOLD',
            soldOrderId: order.id,
            soldAt: new Date(),
          },
        })

        if (stockClaimed.count === 0) {
          // 并发下该码已被抢：抛错回滚，订单保持原状态由调用方重试
          throw new Error('SHOP_STOCK_RACE')
        }

        codeRecords.push(candidate.activationCode)
      }
    } else {
      // 动态生成：按商品规格 × 数量生成新码
      const generated = await generateActivationCodes(tx as typeof prisma, {
        projectKey: product.project.projectKey,
        amount: quantity,
        licenseMode: product.licenseMode as 'TIME' | 'COUNT',
        validDays: product.validDays ?? null,
        totalCount: product.totalCount ?? null,
        cardType: product.cardType ?? null,
      })
      codeRecords = generated
    }

    const codes = codeRecords.map((code) => code.code)
    const fulfilledCodeIds = JSON.stringify(codeRecords.map((code) => code.id))

    await tx.shopOrder.update({
      where: { id: order.id },
      data: { fulfilledCodeIds },
    })

    return { success: true, codes, newlyFulfilled: true }
    })

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
      return {
        success: false,
        message:
          error.message === 'SHOP_OUT_OF_STOCK'
            ? t?.('shop.productSoldOut') ?? '商品已售罄'
            : t?.('payment.fulfillConflict') ?? '库存变更冲突，请重试',
      }
    }
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
