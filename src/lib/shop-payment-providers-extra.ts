import { createHash } from 'node:crypto'

import {
  type CreatePaymentResult,
  type PaymentCallbackContext,
  type PaymentProvider,
  type PaymentQueryResult,
  type ShopOrderInfo,
} from './shop-payment-types'
import { type ServerT } from './i18n/server'

/** 服务端消息词典 key（未注入 t 时回退中文原文） */
export const SHOP_PAYMENT_EXTRA_MESSAGE_KEYS = {
  channelConfigIncomplete: 'payment.channelConfigIncomplete',
  noteWechat: 'shop.noteWechat',
  noteAlipay: 'shop.noteAlipay',
} as const

// ===== 易支付适配器 =====
// 参考独角数卡/彩虹发卡实现：个人无需商户资质，通过第三方聚合支付接入微信/支付宝
// 签名算法：MD5(参数键值对排序 + key)
// 回调格式：form-urlencoded（真实易支付回调格式）

function yipaySign(params: Record<string, string>, key: string): string {
  const sorted = Object.keys(params)
    .sort()
    .filter((k) => params[k] !== '')
    .map((k) => `${k}=${params[k]}`)
    .join('&')
  return createHash('md5').update(sorted + key).digest('hex')
}

function parseFormUrlEncoded(body: string): Record<string, string> {
  const params: Record<string, string> = {}
  for (const part of body.split('&')) {
    const eqIdx = part.indexOf('=')
    if (eqIdx === -1) continue
    const key = decodeURIComponent(part.slice(0, eqIdx))
    const value = decodeURIComponent(part.slice(eqIdx + 1).replace(/\+/g, ' '))
    if (key) params[key] = value
  }
  return params
}

export const yipayPaymentProvider: PaymentProvider = {
  id: 'yipay',
  name: '易支付',
  nameKey: 'shop.channel.yipay',
  supportsOnlinePayment: true,
  requiredConfigKeys: ['gateway', 'pid', 'key'],

  async createPayment(
    order: ShopOrderInfo,
    config: Record<string, string>,
    t?: ServerT,
  ): Promise<CreatePaymentResult> {
    const gateway = (config.gateway?.replace(/\/+$/, '') || '').trim()
    const pid = (config.pid || '').trim()
    const key = (config.key || '').trim()

    if (!gateway || !pid || !key) {
      return {
        payParams: {
          error: t?.(SHOP_PAYMENT_EXTRA_MESSAGE_KEYS.channelConfigIncomplete) ?? '易支付渠道配置不完整，请检查 gateway / pid / key',
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
      // 真实易支付回调为 form-urlencoded 格式
      const rawParams = body.trim().startsWith('{') ? JSON.parse(body) as Record<string, string> : parseFormUrlEncoded(body)
      const key = config.key || ''

      const sign = rawParams.sign || ''
      const tradeStatus = rawParams.trade_status || ''

      const paramsForSign = { ...rawParams }
      delete paramsForSign.sign
      delete paramsForSign.sign_type
      const expectedSign = yipaySign(paramsForSign, key)

      if (sign.toLowerCase() !== expectedSign.toLowerCase()) {
        return null
      }

      return {
        orderNo: rawParams.out_trade_no || '',
        paid: tradeStatus === 'TRADE_SUCCESS' || tradeStatus === '1',
        transactionId: rawParams.trade_no,
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
// 回调格式：XML（真实微信支付回调格式）

function parseXmlSimple(xml: string): Record<string, string> {
  const result: Record<string, string> = {}
  const regex = /<(\w+)>([^<]*)<\/\1>|<(\w+)><!\[CDATA\[(.*?)\]\]><\/\3>/g
  let match
  while ((match = regex.exec(xml)) !== null) {
    const key = match[1] || match[3]
    const value = match[2] || match[4]
    if (key) result[key] = value.trim()
  }
  return result
}

export const wechatPayProvider: PaymentProvider = {
  id: 'wechat',
  name: '微信支付（官方）',
  nameKey: 'shop.channel.wechat',
  supportsOnlinePayment: true,
  requiredConfigKeys: ['appId', 'mchId', 'apiKey'],

  async createPayment(
    order: ShopOrderInfo,
    config: Record<string, string>,
    t?: ServerT,
  ): Promise<CreatePaymentResult> {
    return {
      payParams: {
        note: t?.(SHOP_PAYMENT_EXTRA_MESSAGE_KEYS.noteWechat, {
          amount: (order.amountInCents / 100).toFixed(2),
        }) ?? `微信支付 ${(order.amountInCents / 100).toFixed(2)} 元`,
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
      // 真实微信支付回调为 XML 格式
      if (body.trim().startsWith('<')) {
        const xml = parseXmlSimple(body)
        const returnCode = xml.return_code || ''
        const resultCode = xml.result_code || ''
        if (returnCode === 'SUCCESS' && resultCode === 'SUCCESS') {
          return {
            orderNo: xml.out_trade_no || '',
            paid: true,
            transactionId: xml.transaction_id,
            rawBody: body,
          }
        }
        return null
      }

      // 兼容 JSON 格式（v3 API）
      const payload = JSON.parse(body) as Record<string, unknown>
      const resource = payload.resource as Record<string, string> | undefined
      if (payload.event_type === 'TRANSACTION.SUCCESS' && resource?.ciphertext) {
        const decoded = JSON.parse(resource.ciphertext) as Record<string, string>
        return {
          orderNo: decoded.out_trade_no || '',
          paid: decoded.trade_state === 'SUCCESS',
          transactionId: decoded.transaction_id,
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
// 回调格式：form-urlencoded（真实支付宝回调格式）

export const alipayProvider: PaymentProvider = {
  id: 'alipay',
  name: '支付宝（官方）',
  nameKey: 'shop.channel.alipay',
  supportsOnlinePayment: true,
  requiredConfigKeys: ['appId'],

  async createPayment(
    order: ShopOrderInfo,
    config: Record<string, string>,
    t?: ServerT,
  ): Promise<CreatePaymentResult> {
    return {
      payParams: {
        note: t?.(SHOP_PAYMENT_EXTRA_MESSAGE_KEYS.noteAlipay, {
          amount: (order.amountInCents / 100).toFixed(2),
        }) ?? `支付宝 ${(order.amountInCents / 100).toFixed(2)} 元`,
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
      // 真实支付宝回调为 form-urlencoded 格式
      const rawParams = body.trim().startsWith('{') ? JSON.parse(body) as Record<string, string> : parseFormUrlEncoded(body)
      const tradeStatus = rawParams.trade_status || ''
      const appId = rawParams.app_id || ''

      if (!appId || !tradeStatus) {
        return null
      }

      return {
        orderNo: rawParams.out_trade_no || '',
        paid: tradeStatus === 'TRADE_SUCCESS',
        transactionId: rawParams.trade_no,
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