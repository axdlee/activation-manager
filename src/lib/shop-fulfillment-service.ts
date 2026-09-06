import { prisma } from './db'
import { generateActivationCodes } from './license-generation-service'
import { SHOP_ORDER_STATUS, markShopOrderPaid } from './shop-order-service'

/**
 * 自动发卡服务：支付成功后事务性发码并关联订单。
 * 参考发卡系统「支付即发货」闭环：
 * 订单 paid → 按商品规格生成卡密 → 写入订单 → 标记 fulfilled。
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

  // 幂等：已发卡直接返回
  if (order.status === SHOP_ORDER_STATUS.FULFILLED) {
    const codeIds = readFulfilledCodeIds(order.fulfilledCodeIds)
    const codes = codeIds.length > 0
      ? (await prisma.activationCode.findMany({
          where: { id: { in: codeIds } },
          orderBy: { id: 'asc' },
        })).map((code) => code.code)
      : []
    return {
      success: true,
      alreadyProcessed: true,
      codes,
    }
  }

  if (order.status === SHOP_ORDER_STATUS.CANCELLED) {
    return { success: false, message: '订单已取消' }
  }

  // 先标记已支付（未支付订单不能发卡）
  if (order.status === SHOP_ORDER_STATUS.PENDING) {
    const paidResult = await markShopOrderPaid({
      orderNo: order.orderNo,
      transactionId: params.transactionId,
      adminUsername: params.adminUsername,
    })
    if (!paidResult.success) {
      return { success: false, message: paidResult.message }
    }
  }

  // 生成卡密（每个商品 1 张）
  const product = order.product
  const generated = await generateActivationCodes(prisma, {
    projectKey: product.project.projectKey,
    amount: 1,
    licenseMode: product.licenseMode as 'TIME' | 'COUNT',
    validDays: product.validDays ?? null,
    totalCount: product.totalCount ?? null,
    cardType: product.cardType ?? null,
  })

  const codes = generated.map((code) => code.code)
  const fulfilledCodeIds = JSON.stringify(generated.map((code) => code.id))

  await prisma.shopOrder.update({
    where: { id: order.id },
    data: {
      status: SHOP_ORDER_STATUS.FULFILLED,
      fulfilledAt: new Date(),
      fulfilledCodeIds,
    },
  })

  return { success: true, codes }
}

function readFulfilledCodeIds(fulfilledCodeIds: string | null): number[] {
  if (!fulfilledCodeIds) {
    return []
  }
  try {
    const parsed = JSON.parse(fulfilledCodeIds) as unknown
    return Array.isArray(parsed) ? parsed.filter((item): item is number => typeof item === 'number') : []
  } catch {
    return []
  }
}
