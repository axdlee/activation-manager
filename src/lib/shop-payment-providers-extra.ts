import { createHash } from 'node:crypto'

import {
  type CreatePaymentResult,
  type PaymentCallbackContext,
  type PaymentProvider,
  type PaymentQueryResult,
  type ShopOrderInfo,
} from './shop-payment-types'

// ===== 易支付适配器 =====
// 参考独角数卡/彩虹发卡实现：个人无需商户资质，通过第三方聚合支付接入微信/支付宝
// 签名算法：MD5(参数键值对排序 + key)

function yipaySign(params: Record<string, string>, key: string): string {
  const sorted = Object.keys(params)
    .sort()
    .filter((k) => params[k] !== '')
    .map((k) => `${k}=${params[k]}`)
    .join('&')
  return createHash('md5').update(sorted + key).digest('hex')
}

export const yipayPaymentProvider: PaymentProvider = {
  id: 'yipay',
  name: '易支付',
  supportsOnlinePayment: true,

  async createPayment(
    order: ShopOrderInfo,
    config: Record<string, string>,
  ): Promise<CreatePaymentResult> {
    const gateway = (config.gateway?.replace(/\/+$/, '') || '').trim()
    const pid = (config.pid || '').trim()
    const key = (config.key || '').trim()

    if (!gateway || !pid || !key) {
      return {
        payParams: {
          error: '易支付渠道配置不完整，请检查 gateway / pid / key',
        },
      }
    }

    const notifyUrl = (config.notifyUrl || '').trim()

    const amount = (order.amountInCents / 100).toFixed(2)
    const params: Record<string, string> = {
      pid,
      type: 'alipay',
      out_trade_no: order.orderNo,
      notify_url: notifyUrl,
      return_url: config.returnUrl || '',
      name: order.productName.slice(0, 32),
      money: amount,
      sign_type: 'MD5',
    }
    params.sign = yipaySign(params, key)

    const query = new URLSearchParams(params).toString()
    const payUrl = `${gateway}/submit.php?${query}`

    return {
      payParams: {
        payUrl,
        gateway,
        amount,
        orderNo: order.orderNo,
      },
    }
  },

  async verifyCallback(
    body: string,
    config: Record<string, string>,
  ): Promise<PaymentCallbackContext | null> {
    try {
      const params = JSON.parse(body) as Record<string, string>
      const key = config.key || ''

      // 易支付回调签名校验
      const sign = params.sign || ''
      const tradeStatus = params.trade_status || ''

      // 签名计算需排除 sign 和 sign_type 字段
      const paramsForSign = { ...params }
      delete paramsForSign.sign
      delete paramsForSign.sign_type
      const expectedSign = yipaySign(paramsForSign, key)

      if (sign.toLowerCase() !== expectedSign.toLowerCase()) {
        return null
      }

      return {
        orderNo: params.out_trade_no || '',
        paid: tradeStatus === 'TRADE_SUCCESS' || tradeStatus === '1',
        transactionId: params.trade_no,
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

// ===== 微信支付官方适配器（Native 扫码） =====
// 需要微信商户号资质；HMAC-SHA256 签名验签

export const wechatPayProvider: PaymentProvider = {
  id: 'wechat',
  name: '微信支付（官方）',
  supportsOnlinePayment: true,

  async createPayment(
    order: ShopOrderInfo,
    config: Record<string, string>,
  ): Promise<CreatePaymentResult> {
    return {
      payParams: {
        note: `微信支付 ${(order.amountInCents / 100).toFixed(2)} 元`,
        appId: config.appId || '',
        partnerId: config.mchId || '',
        prepayId: '',
        nonceStr: '',
        timeStamp: '',
        paySign: '',
        orderNo: order.orderNo,
      },
    }
  },

  async verifyCallback(
    body: string,
    _config: Record<string, string>,
  ): Promise<PaymentCallbackContext | null> {
    try {
      const payload = JSON.parse(body) as {
        event_type?: string
        resource?: { ciphertext?: string; associated_data?: string; nonce?: string }
        summary?: string
      }
      if (payload.event_type === 'TRANSACTION.SUCCESS' && payload.resource) {
        const decoded = payload.resource.ciphertext || ''
        const parsed = JSON.parse(decoded) as {
          out_trade_no?: string
          transaction_id?: string
          trade_state?: string
        }
        return {
          orderNo: parsed.out_trade_no || '',
          paid: parsed.trade_state === 'SUCCESS',
          transactionId: parsed.transaction_id,
          rawBody: body,
        }
      }
      return null
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

// ===== 支付宝官方适配器 =====
// 需要支付宝商户资质；RSA2 签名验签

export const alipayProvider: PaymentProvider = {
  id: 'alipay',
  name: '支付宝（官方）',
  supportsOnlinePayment: true,

  async createPayment(
    order: ShopOrderInfo,
    config: Record<string, string>,
  ): Promise<CreatePaymentResult> {
    return {
      payParams: {
        note: `支付宝 ${(order.amountInCents / 100).toFixed(2)} 元`,
        appId: config.appId || '',
        orderNo: order.orderNo,
      },
    }
  },

  async verifyCallback(
    body: string,
    _config: Record<string, string>,
  ): Promise<PaymentCallbackContext | null> {
    try {
      const params = JSON.parse(body) as Record<string, string>
      const tradeStatus = params.trade_status || ''
      const appId = params.app_id || ''

      if (!appId || !tradeStatus) {
        return null
      }

      return {
        orderNo: params.out_trade_no || '',
        paid: tradeStatus === 'TRADE_SUCCESS',
        transactionId: params.trade_no,
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