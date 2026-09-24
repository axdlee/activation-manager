'use client'

import * as React from 'react'
import { X } from 'lucide-react'

import type { ShopOrder } from '@/lib/shop-admin-data'
import { formatPrice, getShopOrderStatusLabel } from '@/lib/shop-admin-data'
import { useI18n } from '@/lib/i18n/i18n-provider'

export type ShopOrderDetailDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: ShopOrder | null
  onConfirmOrder?: (order: ShopOrder) => void
  onResendEmail?: (order: ShopOrder) => void
  onCancelOrder?: (order: ShopOrder) => void
  loading?: boolean
}

/**
 * 订单详情 Drawer：订单摘要 + 投递信息（支付/发卡时间）+ 操作（确认收款 / 重发邮件 / 取消订单）。
 * 卡密明细由公开查询接口按联系方式找回，后台不在此重复展示明文卡密。
 */
export function ShopOrderDetailDrawer({
  open,
  onOpenChange,
  order,
  onConfirmOrder,
  onResendEmail,
  onCancelOrder,
  loading = false,
}: ShopOrderDetailDrawerProps) {
  const { t } = useI18n()
  const titleId = React.useId()
  const restoreFocusRef = React.useRef<HTMLElement | null>(null)

  React.useEffect(() => {
    if (open) {
      restoreFocusRef.current = document.activeElement as HTMLElement | null
    } else if (restoreFocusRef.current) {
      restoreFocusRef.current.focus?.()
      restoreFocusRef.current = null
    }
  }, [open])

  React.useEffect(() => {
    if (!open) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [open, onOpenChange])

  if (!open || !order) return null

  const deliveryEntries = [
    { label: t('shopOrder.paidAt', '支付时间'), value: order.paidAt },
    { label: t('shopOrder.fulfilledAt', '发卡时间'), value: order.fulfilledAt },
    { label: t('shopOrder.paymentNote', '支付凭证'), value: order.paymentNote },
  ]

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button
        type="button"
        aria-label={t('shopOrder.close', '关闭详情')}
        onClick={() => onOpenChange(false)}
        className="absolute inset-0 bg-black/50"
      />
      <div
        className="absolute inset-y-0 right-0 flex w-full flex-col border-l bg-card shadow-lg animate-in slide-in-from-right duration-200"
        style={{ maxWidth: 480 }}
      >
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate font-mono text-base font-semibold text-foreground">
              {order.orderNo}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {order.productName} · ×{order.quantity}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label={t('shopOrder.close', '关闭详情')}
            className="shrink-0 rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">{t('shopOrder.summarySection', '订单摘要')}</h3>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">{t('shopOrder.statusLabel', '状态')}</dt>
              <dd>{getShopOrderStatusLabel(order.status)}</dd>
              <dt className="text-muted-foreground">{t('shopOrder.amountLabel', '金额')}</dt>
              <dd className="tabular-nums">{formatPrice(order.amountInCents)}</dd>
              <dt className="text-muted-foreground">{t('shopOrder.providerLabel', '支付渠道')}</dt>
              <dd>{order.provider}</dd>
              <dt className="text-muted-foreground">{t('shopOrder.createdAtLabel', '下单时间')}</dt>
              <dd className="tabular-nums">{new Date(order.createdAt).toLocaleString()}</dd>
            </dl>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">{t('shopOrder.contactSection', '联系方式')}</h3>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">{t('shopOrder.email', '邮箱')}</dt>
              <dd className="break-all">{order.contactEmail || '—'}</dd>
              <dt className="text-muted-foreground">{t('shopOrder.phone', '手机号')}</dt>
              <dd>{order.contactPhone || '—'}</dd>
              <dt className="text-muted-foreground">{t('shopOrder.wechat', '微信号')}</dt>
              <dd>{order.contactWechat || '—'}</dd>
            </dl>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">{t('shopOrder.deliverySection', '投递信息')}</h3>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              {deliveryEntries.map((entry) => (
                <React.Fragment key={entry.label}>
                  <dt className="text-muted-foreground">{entry.label}</dt>
                  <dd className="break-all tabular-nums">{entry.value || '—'}</dd>
                </React.Fragment>
              ))}
            </dl>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">{t('shopOrder.actionsSection', '操作')}</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onConfirmOrder?.(order)}
                disabled={loading || order.status !== 'pending'}
                className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('shopOrder.confirmOrder', '确认收款发卡')}
              </button>
              <button
                type="button"
                onClick={() => onResendEmail?.(order)}
                disabled={loading || !order.contactEmail || order.status !== 'fulfilled'}
                className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('shopOrder.resendEmail', '重发邮件')}
              </button>
            </div>
            <button
              type="button"
              onClick={() => onCancelOrder?.(order)}
              disabled={loading || order.status !== 'pending'}
              className="inline-flex h-10 w-full items-center justify-center rounded-md border border-destructive/40 bg-background px-3 text-sm font-medium text-destructive shadow-sm transition hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('shopOrder.cancelOrder', '取消订单')}
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}
