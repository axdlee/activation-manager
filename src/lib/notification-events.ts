import {
  dispatchNotification,
  NOTIFICATION_EVENTS,
} from './notification-service'
import { getEmailNotificationConfig, isEmailNotificationConfigured, sendEmail } from './notification-email'
import { type LicenseActionCodeRecord } from './license-action-context'
import {
  buildExpiryNotificationPayload,
} from './license-expiry-notification-service'

/**
 * 事件通知适配层：把业务事件转成统一通知并分发。
 * 拆自 license-expiry-notification-service 的业务入口部分。
 */

export function notifyLicenseExpiryEvent(activationCode: LicenseActionCodeRecord): void {
  dispatchNotification({
    event: NOTIFICATION_EVENTS.LICENSE_EXPIRED,
    title: '激活码到期提醒',
    body: `激活码 ${activationCode.code}（项目 ${activationCode.project?.projectKey ?? '-'}）已到期或次数耗尽。`,
    data: buildExpiryNotificationPayload(activationCode) as unknown as Record<string, unknown>,
  })
}

export function notifyShopOrderFulfilledEvent(params: {
  orderNo: string
  productName: string
  amountInCents: number
  codes: string[]
  trigger: 'payment' | 'admin'
}): void {
  dispatchNotification({
    event: NOTIFICATION_EVENTS.SHOP_ORDER_PAID_FULFILLED,
    title: '订单已发卡',
    body: `订单 ${params.orderNo}（${params.productName}，￥${(params.amountInCents / 100).toFixed(2)}）已完成发卡（${
      params.trigger === 'payment' ? '支付回调' : '人工确认'
    }），共 ${params.codes.length} 张卡密。`,
    data: {
      event: NOTIFICATION_EVENTS.SHOP_ORDER_PAID_FULFILLED,
      orderNo: params.orderNo,
      productName: params.productName,
      amountInCents: params.amountInCents,
      codes: params.codes,
      trigger: params.trigger,
    },
  })
}

export function notifyShopOrderTimeoutCancelledEvent(params: {
  orderNos: string[]
  timeoutMinutes: number
}): void {
  if (params.orderNos.length === 0) {
    return
  }

  dispatchNotification({
    event: NOTIFICATION_EVENTS.SHOP_ORDER_TIMEOUT_CANCELLED,
    title: '超时订单已自动取消',
    body: `本次清理取消 ${params.orderNos.length} 笔超过 ${params.timeoutMinutes} 分钟未支付的订单：${params.orderNos.join('、')}`,
    data: {
      event: NOTIFICATION_EVENTS.SHOP_ORDER_TIMEOUT_CANCELLED,
      orderNos: params.orderNos,
      timeoutMinutes: params.timeoutMinutes,
    },
  })
}

/**
 * 买家发卡邮件：把卡密发送到下单时留下的邮箱。
 * 邮件通知未配置（SMTP/收件人缺失）或无买家邮箱时不发送，返回 false。
 */
export async function sendBuyerOrderFulfilledEmail(params: {
  to: string
  orderNo: string
  productName: string
  amountInCents: number
  codes: string[]
}): Promise<boolean> {
  const recipient = params.to.trim()
  if (!recipient) {
    return false
  }

  const config = await getEmailNotificationConfig()
  if (!isEmailNotificationConfigured(config)) {
    return false
  }

  const amount = (params.amountInCents / 100).toFixed(2)
  return sendEmail({
    to: [recipient],
    subject: `您的卡密已发货 - ${params.productName}（订单 ${params.orderNo}）`,
    text: [
      `您购买的「${params.productName}」（订单号 ${params.orderNo}，实付 ￥${amount}）已完成发卡。`,
      '',
      '卡密列表：',
      ...params.codes.map((code, index) => `${index + 1}. ${code}`),
      '',
      '请妥善保管卡密；如遗失可凭订单号与联系方式在购买页找回。',
    ].join('\n'),
  })
}
