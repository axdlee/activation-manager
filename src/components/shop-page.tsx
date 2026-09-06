'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

import { AppInput } from '@/components/ui/app-input'
import { AppSelect } from '@/components/ui/app-select'
import {
  publicContainerClassName,
  publicPageClassName,
  publicPrimaryButtonClassName,
  publicSecondaryButtonClassName,
  publicShellClassName,
} from '@/lib/public-ui'

type ShopProduct = {
  id: number
  name: string
  description: string | null
  licenseMode: string
  cardType: string | null
  validDays: number | null
  totalCount: number | null
  priceInCents: number
  projectKey: string
}

type PaymentChannel = {
  id: string
  name: string
  supportsOnlinePayment: boolean
}

type CreatedOrder = {
  orderNo: string
  amountInCents: number
  status: string
  provider: string
  productName: string
}

type PaymentInfo = {
  payParams: Record<string, string>
  requirePaymentNote?: boolean
}

type FulfilledResult = {
  order: {
    orderNo: string
    status: string
    amountInCents: number
    productName: string
  }
  codes: Array<{ id: number; code: string; cardType: string | null }>
}

function formatPrice(cents: number) {
  return `¥${(cents / 100).toFixed(2)}`
}

export function ShopPage() {
  const [products, setProducts] = useState<ShopProduct[]>([])
  const [channels, setChannels] = useState<PaymentChannel[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedProductId, setSelectedProductId] = useState<number | null>(null)
  const [providerId, setProviderId] = useState('manual')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactWechat, setContactWechat] = useState('')
  const [paymentNote, setPaymentNote] = useState('')

  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null)
  const [payment, setPayment] = useState<PaymentInfo | null>(null)
  const [fulfilled, setFulfilled] = useState<FulfilledResult | null>(null)

  // 找回卡密
  const [lookupOrderNo, setLookupOrderNo] = useState('')
  const [lookupContact, setLookupContact] = useState('')
  const [lookupResult, setLookupResult] = useState<FulfilledResult | null>(null)
  const [lookupError, setLookupError] = useState('')

  useEffect(() => {
    void (async () => {
      try {
        const [productRes, channelRes] = await Promise.all([
          fetch('/api/shop/products'),
          fetch('/api/shop/payment/channels'),
        ])
        const productData = (await productRes.json()) as { products?: ShopProduct[] }
        const channelData = (await channelRes.json()) as { channels?: PaymentChannel[] }

        setProducts(productData.products ?? [])
        setChannels(channelData.channels ?? [])
        if (productData.products && productData.products.length > 0) {
          setSelectedProductId(productData.products[0]!.id)
        }
        if (channelData.channels && channelData.channels.length > 0) {
          setProviderId(channelData.channels[0]!.id)
        }
      } catch {
        setError('商品加载失败，请稍后重试')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId],
  )

  const selectedChannel = useMemo(
    () => channels.find((channel) => channel.id === providerId) ?? null,
    [channels, providerId],
  )

  const handleCreateOrder = async () => {
    setError('')
    setCreatedOrder(null)
    setPayment(null)
    setFulfilled(null)

    if (!selectedProduct) {
      setError('请先选择商品')
      return
    }
    if (!contactEmail && !contactPhone && !contactWechat) {
      setError('请至少填写邮箱、手机号或微信号中的一种，用于以后找回卡密')
      return
    }

    setCreating(true)
    try {
      const response = await fetch('/api/shop/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProduct.id,
          providerId,
          contactEmail: contactEmail || undefined,
          contactPhone: contactPhone || undefined,
          contactWechat: contactWechat || undefined,
          paymentNote: paymentNote || undefined,
        }),
      })
      const data = (await response.json()) as {
        success: boolean
        message?: string
        order?: CreatedOrder
        payment?: PaymentInfo
      }

      if (!data.success || !data.order) {
        setError(data.message ?? '下单失败')
        return
      }

      setCreatedOrder(data.order)
      setPayment(data.payment ?? null)

      // 轮询订单状态，支付成功后自动显示卡密
      pollOrderStatus(data.order.orderNo)
    } catch {
      setError('下单失败，请稍后重试')
    } finally {
      setCreating(false)
    }
  }

  const pollOrderStatus = (orderNo: string) => {
    let attempts = 0
    const timer = window.setInterval(async () => {
      attempts += 1
      try {
        const response = await fetch(`/api/shop/orders/${orderNo}`)
        const data = (await response.json()) as { success: boolean; order?: { status: string } }
        if (data.success && data.order?.status === 'fulfilled') {
          window.clearInterval(timer)
          const detail = await fetch(`/api/shop/orders/${orderNo}`)
          const detailData = (await detail.json()) as { order?: unknown; codes?: Array<{ id: number; code: string; cardType: string | null }> }
          setFulfilled({
            order: {
              orderNo,
              status: 'fulfilled',
              amountInCents: createdOrder?.amountInCents ?? 0,
              productName: createdOrder?.productName ?? '',
            },
            codes: detailData.codes ?? [],
          })
        }
      } catch {
        // 轮询失败继续重试
      }
      if (attempts > 120) {
        window.clearInterval(timer)
      }
    }, 2000)
  }

  const handleLookup = async () => {
    setLookupError('')
    setLookupResult(null)

    if (!lookupOrderNo || !lookupContact) {
      setLookupError('请填写订单号与联系方式')
      return
    }

    try {
      const response = await fetch('/api/shop/orders/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNo: lookupOrderNo,
          contactEmail: lookupContact.includes('@') ? lookupContact : undefined,
          contactPhone: /^\d+$/.test(lookupContact) ? lookupContact : undefined,
          contactWechat: !lookupContact.includes('@') && !/^\d+$/.test(lookupContact) ? lookupContact : undefined,
        }),
      })
      const data = (await response.json()) as { success: boolean; message?: string; codes?: Array<{ id: number; code: string; cardType: string | null }>; order?: unknown }
      if (!data.success) {
        setLookupError(data.message ?? '查询失败')
        return
      }
      setLookupResult({
        order: data.order as FulfilledResult['order'],
        codes: data.codes ?? [],
      })
    } catch {
      setLookupError('查询失败，请稍后重试')
    }
  }

  return (
    <main className={`${publicPageClassName} min-h-screen`}>
      <div className={publicContainerClassName}>
        <header className={`${publicShellClassName} p-6`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-ink-50">激活码购买中心</h1>
              <p className="mt-1 text-sm leading-6 text-ink-500">
                选择套餐、填写联系方式下单，支付成功后自动发放卡密。
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/" className={publicSecondaryButtonClassName}>
                返回首页
              </Link>
              <Link href="/docs/api" className={publicSecondaryButtonClassName}>
                API 文档
              </Link>
            </div>
          </div>
        </header>

        {/* 下单区 */}
        <section className={`${publicShellClassName} p-6`}>
          {loading ? (
            <div className="py-10 text-center text-sm text-ink-500">正在加载商品…</div>
          ) : (
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-ink-200">选择套餐</label>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {products.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => setSelectedProductId(product.id)}
                        className={`rounded-lg border p-4 text-left transition ${
                          selectedProductId === product.id
                            ? 'border-brand-500/50 bg-brand-500/10 shadow-glow'
                            : 'border-surface-200 bg-surface-100 hover:border-brand-500/30'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold text-ink-50">{product.name}</span>
                          <span className="shrink-0 text-base font-bold text-brand-400">
                            {formatPrice(product.priceInCents)}
                          </span>
                        </div>
                        {product.description ? (
                          <p className="mt-1 text-xs leading-5 text-ink-500">{product.description}</p>
                        ) : null}
                        <p className="mt-2 text-xs text-ink-500">
                          {product.licenseMode === 'TIME'
                            ? `有效期 ${product.validDays ?? '-'} 天`
                            : `共 ${product.totalCount ?? '-'} 次`}
                        </p>
                      </button>
                    ))}
                    {products.length === 0 ? (
                      <div className="col-span-full py-8 text-center text-sm text-ink-500">
                        暂无在售套餐
                      </div>
                    ) : null}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-ink-200">支付方式</label>
                  <AppSelect value={providerId} onChange={(event) => setProviderId(event.target.value)}>
                    {channels.map((channel) => (
                      <option key={channel.id} value={channel.id}>
                        {channel.name}
                        {channel.supportsOnlinePayment ? '（在线支付）' : '（人工确认）'}
                      </option>
                    ))}
                  </AppSelect>
                </div>

                <div className="space-y-3">
                  <div>
                    <label htmlFor="contact-email" className="mb-1.5 block text-sm font-medium text-ink-200">
                      邮箱 <span className="text-xs text-ink-500">（用于找回卡密，建议填写）</span>
                    </label>
                    <AppInput
                      id="contact-email"
                      type="email"
                      value={contactEmail}
                      onChange={(event) => setContactEmail(event.target.value)}
                      placeholder="you@example.com"
                    />
                  </div>
                  <div>
                    <label htmlFor="contact-phone" className="mb-1.5 block text-sm font-medium text-ink-200">
                      手机号
                    </label>
                    <AppInput
                      id="contact-phone"
                      type="tel"
                      value={contactPhone}
                      onChange={(event) => setContactPhone(event.target.value)}
                      placeholder="13800138000"
                    />
                  </div>
                  <div>
                    <label htmlFor="contact-wechat" className="mb-1.5 block text-sm font-medium text-ink-200">
                      微信号
                    </label>
                    <AppInput
                      id="contact-wechat"
                      value={contactWechat}
                      onChange={(event) => setContactWechat(event.target.value)}
                      placeholder="微信号（找回卡密用）"
                    />
                  </div>
                </div>

                {error ? (
                  <div className="rounded-md border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
                    {error}
                  </div>
                ) : null}

                <button
                  type="button"
                  disabled={creating || products.length === 0}
                  onClick={() => void handleCreateOrder()}
                  className={`w-full ${publicPrimaryButtonClassName}`}
                >
                  {creating ? '正在生成订单…' : '立即下单'}
                </button>
              </div>

              {/* 订单/支付/卡密区 */}
              <div className="space-y-5">
                {createdOrder ? (
                  <div className={`${publicShellClassName} p-6`}>
                    <div className="flex items-center gap-2 rounded-sm border border-brand-500/20 bg-brand-500/10 px-2.5 py-1 text-xs font-medium text-brand-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                      订单已生成
                    </div>
                    <div className="mt-4 space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-ink-500">订单号</span>
                        <span className="font-mono text-ink-50">{createdOrder.orderNo}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-ink-500">商品</span>
                        <span className="text-ink-50">{createdOrder.productName}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-ink-500">金额</span>
                        <span className="font-semibold text-ink-50">
                          {formatPrice(createdOrder.amountInCents)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-ink-500">状态</span>
                        <span className="text-amber-400">等待支付</span>
                      </div>
                    </div>

                    {/* 支付信息 */}
                    {payment ? (
                      <div className="mt-5 rounded-lg border border-surface-200 bg-surface-50 p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-500">
                          支付方式 · {selectedChannel?.name ?? '待确认'}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-ink-300">
                          {payment.payParams.instructions ?? '请完成支付'}
                        </p>
                        {payment.payParams.qrCodeImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={payment.payParams.qrCodeImage}
                            alt="收款二维码"
                            className="mx-auto mt-3 h-48 w-48 rounded-lg border border-surface-200 object-contain"
                          />
                        ) : null}
                        {payment.requirePaymentNote ? (
                          <div className="mt-3">
                            <label className="mb-1.5 block text-xs text-ink-500">
                              支付后请填写交易号 / 备注（便于核对）
                            </label>
                            <AppInput
                              value={paymentNote}
                              onChange={(event) => setPaymentNote(event.target.value)}
                              placeholder="支付交易号或备注"
                            />
                          </div>
                        ) : null}
                        <p className="mt-3 text-xs leading-5 text-ink-500">
                          支付完成后将自动发放卡密，页面会实时刷新。
                        </p>
                      </div>
                    ) : null}

                    {fulfilled ? (
                      <div className="mt-5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4">
                        <div className="text-sm font-semibold text-emerald-400">✅ 支付成功，卡密已发放</div>
                        <div className="mt-3 space-y-2">
                          {fulfilled.codes.map((item) => (
                            <div
                              key={item.id}
                              className="rounded-md border border-surface-200 bg-surface-100 px-4 py-3 font-mono text-sm text-ink-50"
                            >
                              {item.code}
                            </div>
                          ))}
                        </div>
                        <p className="mt-3 text-xs leading-5 text-ink-500">
                          请妥善保存卡密。如遗失，可在下方用订单号 + 联系方式找回。
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </section>

        {/* 找回卡密区 */}
        <section className={`${publicShellClassName} p-6`}>
          <h2 className="text-lg font-semibold text-ink-50">找回卡密</h2>
          <p className="mt-1 text-sm leading-6 text-ink-500">
            忘记卡密时，用下单时填写的邮箱 / 手机号 / 微信号 + 订单号即可重新获取。
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <AppInput
              value={lookupOrderNo}
              onChange={(event) => setLookupOrderNo(event.target.value)}
              placeholder="订单号，如 SO…"
            />
            <AppInput
              value={lookupContact}
              onChange={(event) => setLookupContact(event.target.value)}
              placeholder="下单时的邮箱 / 手机号 / 微信号"
            />
            <button
              type="button"
              onClick={() => void handleLookup()}
              className={publicPrimaryButtonClassName}
            >
              找回卡密
            </button>
          </div>
          {lookupError ? (
            <p className="mt-3 text-sm text-rose-400">{lookupError}</p>
          ) : null}
          {lookupResult ? (
            <div className="mt-4 space-y-2">
              {lookupResult.codes.map((item) => (
                <div
                  key={item.id}
                  className="rounded-md border border-surface-200 bg-surface-100 px-4 py-3 font-mono text-sm text-ink-50"
                >
                  {item.code}
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  )
}
