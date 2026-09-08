import { prisma } from './db'
import { generateActivationCodes } from './license-generation-service'
import {
  notifyShopOrderFulfilledEvent,
  sendBuyerOrderFulfilledEmail,
} from './notification-events'
import { SHOP_ORDER_STATUS } from './shop-order-service'

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
}

export type FulfillShopOrderResult = {
  success: boolean
  alreadyProcessed?: boolean
  message?: string
  codes?: string[]
}

export async function fulfillShopOrder(
  params: FulfillShopOrderParams,
): Promise<FulfillShopOrderResult> {
  const order = await prisma.shopOrder.findUnique({
    where: { orderNo: params.orderNo },
    include: { product: { include: { project: true } } },
  })

  if (!order) {
    return { success: false, message: '订单不存在' }
  }

  if (order.status === SHOP_ORDER_STATUS.CANCELLED) {
    return { success: false, message: '订单已取消' }
  }

  if (order.status === SHOP_ORDER_STATUS.FULFILLED) {
    return {
      success: true,
      alreadyProcessed: true,
      codes: await readFulfilledCodes(order.fulfilledCodeIds),
    }
  }

  // 事务内原子抢占：只有 pending/paid → fulfilled 转换成功的请求才发卡
  // 码池售罄/并发抢码冲突时返回业务失败（事务回滚，订单回到原状态）
  try {
    const txResult = await prisma.$transaction(
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
          codes: await readFulfilledCodes(latest.fulfilledCodeIds),
        }
      }
      return { success: false, message: '订单状态已变化，无法发卡' }
    }

    // 抢占成功：按商品发卡模式处理（失败则整个事务回滚，订单保持原状态）
    const product = order.product
    let codeRecords: Array<{ id: number; code: string }>

    if (product.stockMode === 'PREDEFINED') {
      // 预定义码池：原子取一张 AVAILABLE 码（条件更新防并发超卖）
      const stock = await tx.shopProductCodeStock.findFirst({
        where: { productId: product.id, status: 'AVAILABLE' },
        include: { product: false },
      })

      if (!stock) {
        // 码池售罄：抛错回滚订单
        throw new Error('SHOP_OUT_OF_STOCK')
      }

      const stockClaimed = await tx.shopProductCodeStock.updateMany({
        where: { id: stock.id, status: 'AVAILABLE' },
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

      const activationCode = await tx.activationCode.findUniqueOrThrow({
        where: { id: stock.activationCodeId },
        select: { id: true, code: true },
      })
      codeRecords = [activationCode]
    } else {
      // 动态生成：按商品规格生成新码
      const generated = await generateActivationCodes(tx as typeof prisma, {
        projectKey: product.project.projectKey,
        amount: 1,
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
        message: error.message === 'SHOP_OUT_OF_STOCK' ? '商品已售罄' : '库存变更冲突，请重试',
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

async function readFulfilledCodes(fulfilledCodeIds: string | null): Promise<string[] | undefined> {
  const ids = parseFulfilledCodeIds(fulfilledCodeIds)
  if (ids.length === 0) {
    return undefined
  }
  const codes = await prisma.activationCode.findMany({
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
