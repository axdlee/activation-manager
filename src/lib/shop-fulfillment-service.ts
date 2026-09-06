import { prisma } from './db'
import { generateActivationCodes } from './license-generation-service'
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
  return prisma.$transaction(async (tx) => {
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

    // 抢占成功：在事务内生成卡密（失败则整个事务回滚，订单保持原状态）
    const product = order.product
    const generated = await generateActivationCodes(tx as typeof prisma, {
      projectKey: product.project.projectKey,
      amount: 1,
      licenseMode: product.licenseMode as 'TIME' | 'COUNT',
      validDays: product.validDays ?? null,
      totalCount: product.totalCount ?? null,
      cardType: product.cardType ?? null,
    })

    const codes = generated.map((code) => code.code)
    const fulfilledCodeIds = JSON.stringify(generated.map((code) => code.id))

    await tx.shopOrder.update({
      where: { id: order.id },
      data: { fulfilledCodeIds },
    })

    return { success: true, codes }
  })
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
