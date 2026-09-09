import {
  type CreatePaymentResult,
  type PaymentCallbackContext,
  type PaymentCallbackResult,
  type PaymentProvider,
  type PaymentQueryResult,
  type ShopOrderInfo,
} from './shop-payment-types'
import { type ServerT } from './i18n/server'

/** 服务端消息词典 key（未注入 t 时回退中文原文） */
export const SHOP_PAYMENT_MESSAGE_KEYS = {
  instructionsManual: 'shop.instructionsManual',
  noteWebhook: 'shop.noteWebhook',
  callbackVerifyFailed: 'payment.callbackVerifyFailed',
} as const

/**
 * 手动收款确认适配器（无商户资质兜底）。
 * 展示收款码/收款说明 → 买家付款后回填交易号 → 管理员后台确认 → 自动发卡。
 */
export const manualPaymentProvider: PaymentProvider = {
  id: 'manual',
  name: '手动收款确认',
  nameKey: 'shop.channel.manual',
  supportsOnlinePayment: false,
  // 手动收款是兜底渠道：无强制配置（account/qrCode 可选，instructions 有默认）*/
  requiredConfigKeys: [],

  async createPayment(
    order: ShopOrderInfo,
    config: Record<string, string>,
    t?: ServerT,
  ): Promise<CreatePaymentResult> {
    const defaultInstructions = t?.(SHOP_PAYMENT_MESSAGE_KEYS.instructionsManual, {
      amount: (order.amountInCents / 100).toFixed(2),
      orderNo: order.orderNo,
    }) ?? `请向收款账户支付 ${(order.amountInCents / 100).toFixed(2)} 元，并在备注中填写订单号 ${order.orderNo}`
    return {
      payParams: {
        account: config.account ?? '',
        qrCodeImage: config.qrCodeImage ?? '',
        instructions:
          config.instructions ??
          defaultInstructions,
      },
      requirePaymentNote: true,
    }
  },

  async verifyCallback(
    _body: string,
    _config: Record<string, string>,
  ): Promise<PaymentCallbackContext | null> {
    // manual 渠道不走回调：由管理员在后台确认
    return null
  },

  async queryPayment(
    _orderNo: string,
    _config: Record<string, string>,
  ): Promise<PaymentQueryResult> {
    return { paid: false }
  },
}

/**
 * 通用 Webhook 回调适配器。
 * 自建支付监控服务（或未来接入的支付渠道）在收到支付通知后，
 * 向系统 POST /api/shop/payment/webhook 携带订单号即可触发发卡。
 */
export const webhookPaymentProvider: PaymentProvider = {
  id: 'webhook',
  name: '通用支付回调',
  nameKey: 'shop.channel.webhook',
  supportsOnlinePayment: true,
  requiredConfigKeys: [],

  async createPayment(
    order: ShopOrderInfo,
    _config: Record<string, string>,
    t?: ServerT,
  ): Promise<CreatePaymentResult> {
    return {
      payParams: {
        note: t?.(SHOP_PAYMENT_MESSAGE_KEYS.noteWebhook, {
          amount: (order.amountInCents / 100).toFixed(2),
          orderNo: order.orderNo,
        }) ?? `请向指定收款渠道支付 ${(order.amountInCents / 100).toFixed(2)} 元，订单号 ${order.orderNo}`,
      },
      requirePaymentNote: true,
    }
  },

  async verifyCallback(
    body: string,
    _config: Record<string, string>,
  ): Promise<PaymentCallbackContext | null> {
    try {
      const payload = JSON.parse(body) as {
        orderNo?: string
        paid?: boolean
        transactionId?: string
      }
      if (!payload.orderNo) {
        return null
      }
      return {
        orderNo: payload.orderNo,
        paid: payload.paid !== false,
        transactionId: payload.transactionId,
        rawBody: body,
      }
    } catch {
      return null
    }
  },

  async queryPayment(
    _orderNo: string,
    _config: Record<string, string>,
  ): Promise<PaymentQueryResult> {
    return { paid: false }
  },
}

export function handleWebhookCallback(
  provider: PaymentProvider,
  body: string,
  config: Record<string, string>,
  t?: ServerT,
): Promise<PaymentCallbackResult> {
  return (async () => {
    const context = await provider.verifyCallback(body, config)
    if (!context) {
      return { success: false, message: t?.(SHOP_PAYMENT_MESSAGE_KEYS.callbackVerifyFailed) ?? '回调校验失败' }
    }
    return { success: true, paid: context.paid, transactionId: context.transactionId }
  })()
}
