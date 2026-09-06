/**
 * 支付网关适配器抽象层（参考独角数卡/彩虹发卡的多渠道适配设计）。
 *
 * 每个支付渠道实现 PaymentProvider 接口，订单/发卡/找回逻辑与渠道解耦。
 * 内置：
 *  - manual：手动收款码 + 管理员确认（无资质兜底）
 *  - webhook：通用回调（自建服务收到支付通知后 POST 回调）
 * 未来接微信/支付宝/易支付等只需新增适配器并在 registry 注册。
 */

export type ShopOrderInfo = {
  orderNo: string
  amountInCents: number
  productName: string
  contactEmail?: string | null
  contactPhone?: string | null
  contactWechat?: string | null
}

export type CreatePaymentResult = {
  /** 渠道生成的支付参数（如二维码内容 / 收款说明），透传给前端 */
  payParams: Record<string, string>
  /** 需要用户在支付后回填的交易号/备注（manual 渠道用于对账） */
  requirePaymentNote?: boolean
}

export type PaymentCallbackContext = {
  orderNo: string
  /** 渠道确认支付成功 */
  paid: boolean
  /** 渠道侧交易号 */
  transactionId?: string
  /** 原始回调体（供验签/审计） */
  rawBody?: string
}

export type PaymentCallbackResult = {
  success: boolean
  /** 是否已处理（避免重复回调重复发卡） */
  alreadyProcessed?: boolean
  message?: string
}

export type PaymentQueryResult = {
  paid: boolean
  transactionId?: string | null
}

export interface PaymentProvider {
  readonly id: string
  readonly name: string
  /** 是否支持在线支付（false = 需人工确认） */
  readonly supportsOnlinePayment: boolean
  createPayment(order: ShopOrderInfo, config: Record<string, string>): Promise<CreatePaymentResult>
  verifyCallback(body: string, config: Record<string, string>): Promise<PaymentCallbackContext | null>
  queryPayment(orderNo: string, config: Record<string, string>): Promise<PaymentQueryResult>
}

export type PaymentProviderRegistry = Record<string, PaymentProvider>
