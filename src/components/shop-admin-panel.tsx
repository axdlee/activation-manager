'use client'

import React, { useEffect, useState } from 'react'

import { AppInput } from '@/components/ui/app-input'
import { AppSelect } from '@/components/ui/app-select'
import { panelClassName } from '@/lib/dashboard-class-names'

type ShopProduct = {
  id: number
  name: string
  description: string | null
  projectKey: string
  licenseMode: string
  cardType: string | null
  validDays: number | null
  totalCount: number | null
  priceInCents: number
  isEnabled: boolean
  sortOrder: number
}

type ShopOrder = {
  id: number
  orderNo: string
  productName: string
  amountInCents: number
  status: string
  provider: string
  contactEmail: string | null
  contactPhone: string | null
  contactWechat: string | null
  paymentNote: string | null
  paidAt: string | null
  fulfilledAt: string | null
  createdAt: string
}

type PaymentConfig = {
  provider: string
  configJson: string
  isEnabled: boolean
}

type ProjectOption = {
  id: number
  projectKey: string
  name: string
}

type ShopAdminTab = 'products' | 'orders' | 'channels'

function formatPrice(cents: number) {
  return `¥${(cents / 100).toFixed(2)}`
}

const statusLabelMap: Record<string, string> = {
  pending: '待支付',
  paid: '已支付',
  fulfilled: '已发卡',
  cancelled: '已取消',
}

const statusToneMap: Record<string, string> = {
  pending: 'text-amber-400',
  paid: 'text-blue-400',
  fulfilled: 'text-emerald-400',
  cancelled: 'text-ink-500',
}

export function ShopAdminPanel() {
  const [tab, setTab] = useState<ShopAdminTab>('products')
  const [products, setProducts] = useState<ShopProduct[]>([])
  const [orders, setOrders] = useState<ShopOrder[]>([])
  const [configs, setConfigs] = useState<PaymentConfig[]>([])
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [webhookSecretLoaded, setWebhookSecretLoaded] = useState(false)

  // 新建商品表单
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    projectId: '',
    licenseMode: 'TIME',
    cardType: '月卡',
    validDays: '30',
    totalCount: '',
    priceInCents: '',
  })

  useEffect(() => {
    void loadAll()
    void loadProjects()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const notify = (content: string, type: 'success' | 'error' = 'success') => {
    setMessage(content)
    setMessageType(type)
  }

  const loadProjects = async () => {
    try {
      const response = await fetch('/api/admin/projects')
      const data = (await response.json()) as { projects?: Array<{ id: number; projectKey: string; name: string }> }
      setProjects(data.projects ?? [])
    } catch {
      // 忽略
    }
  }

  const loadAll = async () => {
    const [productRes, orderRes, configRes] = await Promise.all([
      fetch('/api/admin/shop/products'),
      fetch('/api/admin/shop/orders?status=all'),
      fetch('/api/admin/shop/payment-configs'),
    ])
    const productData = (await productRes.json()) as { products?: ShopProduct[] }
    const orderData = (await orderRes.json()) as { orders?: ShopOrder[] }
    const configData = (await configRes.json()) as { configs?: PaymentConfig[] }

    setProducts(productData.products ?? [])
    setOrders(orderData.orders ?? [])
    setConfigs(configData.configs ?? [])

    // 预填 webhook secret（若已配置）
    const webhookConfig = (configData.configs ?? []).find((item) => item.provider === 'webhook')
    if (webhookConfig) {
      try {
        const parsed = JSON.parse(webhookConfig.configJson) as Record<string, string>
        setWebhookSecret(parsed.secret ?? '')
      } catch {
        setWebhookSecret('')
      }
    }
    setWebhookSecretLoaded(true)
  }

  const handleCreateProduct = async () => {
    if (!newProduct.name || !newProduct.projectId || !newProduct.priceInCents) {
      notify('请填写商品名称、项目与价格', 'error')
      return
    }

    try {
      const response = await fetch('/api/admin/shop/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProduct.name,
          description: newProduct.description || undefined,
          projectId: Number(newProduct.projectId),
          licenseMode: newProduct.licenseMode,
          cardType: newProduct.cardType || undefined,
          validDays: newProduct.licenseMode === 'TIME' ? Number(newProduct.validDays) : null,
          totalCount: newProduct.licenseMode === 'COUNT' ? Number(newProduct.totalCount) : null,
          priceInCents: Math.round(Number(newProduct.priceInCents) * 100),
        }),
      })
      const data = (await response.json()) as { success: boolean; message?: string }
      if (!data.success) {
        notify(data.message ?? '创建失败', 'error')
        return
      }
      notify('商品创建成功')
      setNewProduct({ name: '', description: '', projectId: '', licenseMode: 'TIME', cardType: '月卡', validDays: '30', totalCount: '', priceInCents: '' })
      await loadAll()
    } catch {
      notify('创建失败', 'error')
    }
  }

  const handleToggleProduct = async (product: ShopProduct) => {
    try {
      await fetch(`/api/admin/shop/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: !product.isEnabled }),
      })
      await loadAll()
    } catch {
      notify('操作失败', 'error')
    }
  }

  const handleDeleteProduct = async (product: ShopProduct) => {
    if (!window.confirm(`确定删除商品「${product.name}」吗？`)) return
    try {
      await fetch(`/api/admin/shop/products/${product.id}`, { method: 'DELETE' })
      await loadAll()
    } catch {
      notify('删除失败', 'error')
    }
  }

  const handleConfirmOrder = async (order: ShopOrder) => {
    if (!window.confirm(`确认订单 ${order.orderNo} 已收款并发放卡密？`)) return
    try {
      const response = await fetch(`/api/admin/shop/orders/${order.orderNo}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: order.paymentNote ?? undefined }),
      })
      const data = (await response.json()) as { success: boolean; message?: string }
      if (!data.success) {
        notify(data.message ?? '确认失败', 'error')
        return
      }
      notify('已确认收款并发放卡密')
      await loadAll()
    } catch {
      notify('操作失败', 'error')
    }
  }

  const handleSaveWebhookSecret = async () => {
    try {
      const response = await fetch('/api/admin/shop/payment-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'webhook',
          configJson: JSON.stringify({ secret: webhookSecret.trim() }),
        }),
      })
      const data = (await response.json()) as { success: boolean; message?: string }
      if (!data.success) {
        notify(data.message ?? '保存失败', 'error')
        return
      }
      notify('回调密钥已保存')
      await loadAll()
    } catch {
      notify('保存失败', 'error')
    }
  }

  const handleToggleChannel = async (config: PaymentConfig) => {
    try {
      await fetch('/api/admin/shop/payment-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: config.provider,
          isEnabled: !config.isEnabled,
        }),
      })
      await loadAll()
    } catch {
      notify('操作失败', 'error')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        {(
          [
            ['products', '商品管理'],
            ['orders', '订单管理'],
            ['channels', '支付渠道'],
          ] as Array<[ShopAdminTab, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition ${
              tab === key
                ? 'bg-brand-600 text-white shadow-glow'
                : 'border border-surface-200 bg-surface-100 text-ink-300 hover:text-ink-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {message ? (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            messageType === 'success'
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
              : 'border-rose-500/20 bg-rose-500/10 text-rose-400'
          }`}
        >
          {message}
        </div>
      ) : null}

      {tab === 'products' ? (
        <div className="space-y-5">
          <div className={`${panelClassName} p-6`}>
            <h3 className="text-lg font-semibold text-ink-50">新建商品</h3>
            <p className="mt-1 text-sm leading-6 text-ink-500">
              商品绑定项目 + 授权套餐，买家下单支付后自动发放卡密。
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <AppInput
                value={newProduct.name}
                onChange={(event) => setNewProduct({ ...newProduct, name: event.target.value })}
                placeholder="商品名称（如 月卡）"
              />
              <AppInput
                value={newProduct.description}
                onChange={(event) => setNewProduct({ ...newProduct, description: event.target.value })}
                placeholder="商品描述（可选）"
              />
              <AppSelect
                value={newProduct.projectId}
                onChange={(event) => setNewProduct({ ...newProduct, projectId: event.target.value })}
              >
                <option value="">选择项目</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} ({project.projectKey})
                  </option>
                ))}
              </AppSelect>
              <AppSelect
                value={newProduct.licenseMode}
                onChange={(event) => setNewProduct({ ...newProduct, licenseMode: event.target.value })}
              >
                <option value="TIME">时间型</option>
                <option value="COUNT">次数型</option>
              </AppSelect>
              {newProduct.licenseMode === 'TIME' ? (
                <>
                  <AppInput
                    value={newProduct.cardType}
                    onChange={(event) => setNewProduct({ ...newProduct, cardType: event.target.value })}
                    placeholder="套餐类型（如 月卡）"
                  />
                  <AppInput
                    type="number"
                    value={newProduct.validDays}
                    onChange={(event) => setNewProduct({ ...newProduct, validDays: event.target.value })}
                    placeholder="有效期（天）"
                  />
                </>
              ) : (
                <AppInput
                  type="number"
                  value={newProduct.totalCount}
                  onChange={(event) => setNewProduct({ ...newProduct, totalCount: event.target.value })}
                  placeholder="总次数"
                />
              )}
              <AppInput
                type="number"
                step="0.01"
                value={newProduct.priceInCents}
                onChange={(event) => setNewProduct({ ...newProduct, priceInCents: event.target.value })}
                placeholder="价格（元）"
              />
              <button
                type="button"
                onClick={() => void handleCreateProduct()}
                className="inline-flex items-center justify-center rounded-md bg-gradient-to-r from-brand-500 via-brand-600 to-brand-700 px-4 py-2.5 text-sm font-medium text-white shadow-glow transition hover:from-brand-400 hover:via-brand-500 hover:to-brand-600"
              >
                创建商品
              </button>
            </div>
          </div>

          <div className={`${panelClassName} p-6`}>
            <h3 className="text-lg font-semibold text-ink-50">在售商品</h3>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-surface-200 text-xs uppercase tracking-[0.18em] text-ink-500">
                    <th className="py-2 pr-4">名称</th>
                    <th className="py-2 pr-4">项目</th>
                    <th className="py-2 pr-4">类型</th>
                    <th className="py-2 pr-4">规格</th>
                    <th className="py-2 pr-4">价格</th>
                    <th className="py-2 pr-4">状态</th>
                    <th className="py-2 pr-4">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-200">
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td className="py-3 pr-4 font-medium text-ink-50">{product.name}</td>
                      <td className="py-3 pr-4 text-ink-400">{product.projectKey}</td>
                      <td className="py-3 pr-4 text-ink-400">
                        {product.licenseMode === 'TIME' ? '时间型' : '次数型'}
                      </td>
                      <td className="py-3 pr-4 text-ink-400">
                        {product.licenseMode === 'TIME'
                          ? `${product.cardType ?? '-'}（${product.validDays ?? '-'} 天）`
                          : `${product.totalCount ?? '-'} 次`}
                      </td>
                      <td className="py-3 pr-4 font-semibold text-brand-400">
                        {formatPrice(product.priceInCents)}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={product.isEnabled ? 'text-emerald-400' : 'text-ink-500'}>
                          {product.isEnabled ? '在售' : '已下架'}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void handleToggleProduct(product)}
                            className="rounded-md border border-surface-200 bg-surface-100 px-2.5 py-1 text-xs text-ink-300 hover:text-ink-50"
                          >
                            {product.isEnabled ? '下架' : '上架'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteProduct(product)}
                            className="rounded-md border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-xs text-rose-400"
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-ink-500">
                        暂无商品，请先创建
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'orders' ? (
        <div className={`${panelClassName} p-6`}>
          <h3 className="text-lg font-semibold text-ink-50">订单管理</h3>
          <p className="mt-1 text-sm leading-6 text-ink-500">
            manual 渠道需人工核对收款后点击确认，系统自动发放卡密。
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead>
                <tr className="border-b border-surface-200 text-xs uppercase tracking-[0.18em] text-ink-500">
                  <th className="py-2 pr-4">订单号</th>
                  <th className="py-2 pr-4">商品</th>
                  <th className="py-2 pr-4">金额</th>
                  <th className="py-2 pr-4">状态</th>
                  <th className="py-2 pr-4">联系方式</th>
                  <th className="py-2 pr-4">支付备注</th>
                  <th className="py-2 pr-4">创建时间</th>
                  <th className="py-2 pr-4">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200">
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="py-3 pr-4 font-mono text-xs text-ink-300">{order.orderNo}</td>
                    <td className="py-3 pr-4 text-ink-50">{order.productName}</td>
                    <td className="py-3 pr-4 font-semibold text-ink-50">
                      {formatPrice(order.amountInCents)}
                    </td>
                    <td className={`py-3 pr-4 font-medium ${statusToneMap[order.status] ?? ''}`}>
                      {statusLabelMap[order.status] ?? order.status}
                    </td>
                    <td className="py-3 pr-4 text-xs text-ink-400">
                      {[order.contactEmail, order.contactPhone, order.contactWechat]
                        .filter(Boolean)
                        .join(' / ') || '-'}
                    </td>
                    <td className="py-3 pr-4 text-xs text-ink-400">{order.paymentNote ?? '-'}</td>
                    <td className="py-3 pr-4 text-xs text-ink-400">
                      {new Date(order.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 pr-4">
                      {order.status === 'pending' ? (
                        <button
                          type="button"
                          onClick={() => void handleConfirmOrder(order)}
                          className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-400"
                        >
                          确认收款发卡
                        </button>
                      ) : order.status === 'fulfilled' ? (
                        <span className="text-xs text-emerald-400">✓ 已发卡</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-ink-500">
                      暂无订单
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === 'channels' ? (
        <div className={`${panelClassName} p-6`}>
          <h3 className="text-lg font-semibold text-ink-50">支付渠道</h3>
          <p className="mt-1 text-sm leading-6 text-ink-500">
            启用渠道后，买家可在下单页选择该支付方式。
          </p>
          <div className="mt-4 space-y-3">
            {configs.map((config) => (
              <div
                key={config.provider}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-surface-200 bg-surface-50 px-4 py-3"
              >
                <div>
                  <div className="text-sm font-medium text-ink-50">
                    {config.provider === 'manual'
                      ? '手动收款确认'
                      : config.provider === 'webhook'
                        ? '通用支付回调'
                        : config.provider}
                  </div>
                  <div className="mt-0.5 text-xs text-ink-500">
                    {config.provider === 'manual'
                      ? '展示收款信息，管理员人工确认后发卡'
                      : config.provider === 'webhook'
                        ? '自建服务回调 POST /api/shop/payment/webhook 触发发卡'
                        : config.provider}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleToggleChannel(config)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    config.isEnabled
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'border border-surface-200 bg-surface-100 text-ink-300'
                  }`}
                >
                  {config.isEnabled ? '已启用' : '未启用'}
                </button>
              </div>
            ))}
            {webhookSecretLoaded ? (
              <div className="rounded-lg border border-surface-200 bg-surface-50 px-4 py-4">
                <div className="text-sm font-medium text-ink-50">通用回调密钥（webhook）</div>
                <p className="mt-0.5 text-xs leading-5 text-ink-500">
                  配置后，回调请求必须携带 <code className="text-brand-400">x-webhook-secret</code>{' '}
                  请求头且值匹配，否则拒绝（防止未授权调用触发免费发卡）。留空则不校验。
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <AppInput
                    value={webhookSecret}
                    onChange={(event) => setWebhookSecret(event.target.value)}
                    placeholder="输入回调密钥（留空不校验）"
                    className="max-w-sm"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSaveWebhookSecret()}
                    className="rounded-md border border-brand-500/20 bg-brand-500/10 px-3 py-1.5 text-xs font-medium text-brand-400 hover:bg-brand-500/20"
                  >
                    保存密钥
                  </button>
                </div>
              </div>
            ) : null}
            {configs.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-500">暂无支付渠道配置</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
