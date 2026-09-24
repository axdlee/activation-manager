'use client'

import * as React from 'react'
import { RefreshCw } from 'lucide-react'

import { PageHeader } from '@/components/admin/page-header'
import { PageToolbar } from '@/components/admin/page-toolbar'
import { ConfirmDialog } from '@/components/admin/confirm-dialog'
import { ShopSubnav } from '@/components/admin/shop-subnav'
import { ShopOrderDetailDrawer } from '@/components/admin/shop-order-detail-drawer'
import { EmptyState } from '@/components/admin/empty-state'
import { Skeleton } from '@/components/ui-admin/skeleton'
import {
  cancelShopOrder,
  cleanupExpiredShopOrders,
  confirmShopOrder,
  fetchShopOrders,
  formatPrice,
  getShopOrderStatusLabel,
  getShopOrderStatusTone,
  resendShopOrderEmail,
  SHOP_ORDER_STATUSES,
  type ShopOrder,
} from '@/lib/shop-admin-data'
import { useI18n } from '@/lib/i18n/i18n-provider'

export type ShopOrdersPageProps = {
  initialOrders?: ShopOrder[]
  onNotify?: (message: string, type?: 'success' | 'error') => void
}

/**
 * 订单管理任务页：状态/渠道筛选 → 订单摘要表 → 行详情 Drawer。
 * 清理超时订单为独立 ConfirmDialog；确认收款保留原生 confirm（与既有 e2e 兼容）。
 */
export function ShopOrdersPage({ initialOrders, onNotify }: ShopOrdersPageProps) {
  const { t } = useI18n()
  const [orders, setOrders] = React.useState<ShopOrder[]>(initialOrders ?? [])
  const [loading, setLoading] = React.useState(false)
  const [statusFilter, setStatusFilter] = React.useState('all')
  const [providerFilter, setProviderFilter] = React.useState('all')
  const [detailOrder, setDetailOrder] = React.useState<ShopOrder | null>(null)
  const [cleanupOpen, setCleanupOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

  const notify = React.useCallback(
    (message: string, type: 'success' | 'error' = 'success') => {
      onNotify?.(message, type)
    },
    [onNotify],
  )

  const load = React.useCallback(async () => {
    setLoading(true)
    setOrders(await fetchShopOrders(statusFilter, providerFilter))
    setLoading(false)
  }, [statusFilter, providerFilter])

  React.useEffect(() => {
    if (initialOrders === undefined) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, providerFilter])

  const handleConfirmOrder = async (order: ShopOrder) => {
    if (!window.confirm(t('shopadmin.confirmOrderPrompt', '确认订单 {{orderNo}} 已收款并发放卡密？').replace('{{orderNo}}', order.orderNo))) return
    setBusy(true)
    const result = await confirmShopOrder(order.orderNo, order.paymentNote ?? undefined)
    setBusy(false)
    if (!result.success) {
      notify(result.message ?? t('shopadmin.confirmFailed', '确认失败'), 'error')
      return
    }
    notify(t('shopadmin.confirmedAndFulfilled', '已确认收款并发放卡密'))
    setDetailOrder(null)
    await load()
  }

  const handleResendEmail = async (order: ShopOrder) => {
    if (
      !window.confirm(
        t('shopadmin.resendEmailConfirm', '向 {{email}} 重发订单 {{orderNo}} 的卡密邮件？')
          .replace('{{email}}', order.contactEmail ?? '')
          .replace('{{orderNo}}', order.orderNo),
      )
    ) {
      return
    }
    setBusy(true)
    const result = await resendShopOrderEmail(order.orderNo)
    setBusy(false)
    if (!result.success) {
      notify(result.message ?? t('shopadmin.resendFailed', '重发失败'), 'error')
      return
    }
    notify(result.message ?? t('shopadmin.resendEmailDone', '卡密邮件已重发'))
  }

  const handleCancelOrder = async (order: ShopOrder) => {
    if (!window.confirm(t('shopadmin.cancelOrderPrompt', '确认取消订单 {{orderNo}}？未支付订单取消后预占库存立即释放。').replace('{{orderNo}}', order.orderNo))) return
    setBusy(true)
    const result = await cancelShopOrder(order.orderNo)
    setBusy(false)
    if (!result.success) {
      notify(result.message ?? t('shopadmin.cancelFailed', '取消失败'), 'error')
      return
    }
    notify(t('shopadmin.cancelDone', '订单已取消，预占库存已释放'))
    setDetailOrder(null)
    await load()
  }

  const handleCleanup = async () => {
    setBusy(true)
    const result = await cleanupExpiredShopOrders()
    setBusy(false)
    if (!result.success) {
      notify(result.message ?? t('shopadmin.cleanupFailed', '清理失败'), 'error')
      return
    }
    notify(result.message ?? t('shopadmin.cleanupDone', '清理完成'))
    setCleanupOpen(false)
    await load()
  }

  const providers = React.useMemo(
    () => Array.from(new Set(orders.map((order) => order.provider))),
    [orders],
  )

  return (
    <>
      <ShopSubnav active="orders" />

      <div className="mt-4">
        <PageHeader
          title={t('shopadmin.ordersTitle', '订单')}
          description={t('shopadmin.ordersDescription', '跟踪支付状态，确认收款后自动发卡。')}
        />
      </div>

      <PageToolbar
        className="mb-3"
        filters={
          <>
            <select
              aria-label={t('shopadmin.orderStatusFilter', '订单状态筛选')}
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {SHOP_ORDER_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
            <select
              aria-label={t('shopadmin.orderProviderFilter', '支付渠道筛选')}
              value={providerFilter}
              onChange={(event) => setProviderFilter(event.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">{t('shopadmin.providerAll', '全部渠道')}</option>
              {providers.map((provider) => (
                <option key={provider} value={provider}>
                  {provider}
                </option>
              ))}
            </select>
          </>
        }
        actions={
          <>
            <button
              type="button"
              onClick={() => void load()}
              aria-label={t('shopadmin.refreshOrders', '刷新订单')}
              title={t('shopadmin.refreshOrders', '刷新订单')}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-input bg-background text-foreground shadow-sm transition hover:bg-accent"
            >
              <RefreshCw className={`h-4 w-4${loading ? ' animate-spin' : ''}`} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setCleanupOpen(true)}
              disabled={busy}
              className="inline-flex h-10 items-center rounded-md border border-destructive/40 bg-background px-3 text-sm font-medium text-destructive shadow-sm transition hover:bg-destructive/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('shopadmin.cleanupExpired', '清理超时订单')}
            </button>
          </>
        }
      />

      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-4 py-3 font-medium">{t('shopadmin.columnOrderNo', '订单号')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('shopadmin.columnProduct', '商品')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('shopadmin.columnAmount', '金额')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('shopadmin.columnStatus', '状态')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('shopadmin.columnContact', '联系方式')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('shopadmin.columnCreatedAt', '下单时间')}</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">{t('shopadmin.columnActions', '操作')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading && orders.length === 0
                ? Array.from({ length: 3 }).map((_, index) => (
                    <tr key={index}>
                      <td colSpan={7} className="px-4 py-3">
                        <Skeleton className="h-8 w-full" />
                      </td>
                    </tr>
                  ))
                : orders.map((order) => (
                    <tr key={order.id} className="transition hover:bg-muted/30">
                      <td className="whitespace-nowrap px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setDetailOrder(order)}
                          className="font-mono text-foreground hover:underline"
                        >
                          {order.orderNo}
                        </button>
                      </td>
                      <td className="max-w-[160px] truncate whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {order.productName} ×{order.quantity}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                        {formatPrice(order.amountInCents)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getShopOrderStatusTone(order.status)}`}
                        >
                          {getShopOrderStatusLabel(order.status)}
                        </span>
                      </td>
                      <td className="max-w-[180px] truncate whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {order.contactEmail || order.contactPhone || order.contactWechat || '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted-foreground">
                        {new Date(order.createdAt).toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {order.status === 'pending' ? (
                          <button
                            type="button"
                            onClick={() => void handleConfirmOrder(order)}
                            disabled={busy}
                            className="inline-flex h-10 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow transition hover:bg-primary/90 disabled:opacity-50"
                          >
                            {t('shopadmin.confirmOrderButton', '确认收款发卡')}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDetailOrder(order)}
                            className="text-sm text-muted-foreground transition hover:text-foreground"
                          >
                            {t('shopadmin.detail', '详情')}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {!loading && orders.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title={t('shopadmin.emptyOrders', '暂无订单')}
              description={t('shopadmin.emptyOrdersDesc', '买家下单后会在这里看到订单与支付状态。')}
            />
          </div>
        ) : null}
      </div>

      <ShopOrderDetailDrawer
        open={detailOrder !== null}
        onOpenChange={(open) => {
          if (!open) setDetailOrder(null)
        }}
        order={detailOrder}
        loading={busy}
        onConfirmOrder={(order) => void handleConfirmOrder(order)}
        onResendEmail={(order) => void handleResendEmail(order)}
        onCancelOrder={(order) => void handleCancelOrder(order)}
      />

      <ConfirmDialog
        open={cleanupOpen}
        onOpenChange={setCleanupOpen}
        title={t('shopadmin.cleanupExpiredTitle', '清理超时订单')}
        description={t(
          'shopadmin.cleanupExpiredConfirm',
          '取消所有超过 30 分钟仍未支付的待支付订单？',
        )}
        confirmLabel={t('shopadmin.cleanupConfirmLabel', '确认清理')}
        destructive
        loading={busy}
        onConfirm={() => void handleCleanup()}
      />
    </>
  )
}
