'use client'

import React, { useEffect, useState } from 'react'

import { AppInput } from '@/components/ui/app-input'
import { AppSelect } from '@/components/ui/app-select'
import { panelClassName } from '@/lib/dashboard-class-names'
import { DashboardModal } from '@/components/dashboard-modal'
import { useI18n } from '@/lib/i18n/i18n-provider'

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
  stockMode: string
}

type ShopOrder = {
  id: number
  orderNo: string
  productName: string
  quantity: number
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
  requiredConfigKeys?: string[]
  missingKeys?: string[]
  configComplete?: boolean
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

const statusLabelMap: Record<string, [string, string]> = {
  pending: ['shopadmin.statusPending', '待支付'],
  paid: ['shopadmin.statusPaid', '已支付'],
  fulfilled: ['shopadmin.statusFulfilled', '已发卡'],
  cancelled: ['shopadmin.statusCancelled', '已取消'],
}

const statusToneMap: Record<string, string> = {
  pending: 'text-amber-400',
  paid: 'text-blue-400',
  fulfilled: 'text-emerald-400',
  cancelled: 'text-muted-foreground',
}

export function ShopAdminPanel() {
  const { t } = useI18n()
  const [tab, setTab] = useState<ShopAdminTab>('products')
  const [products, setProducts] = useState<ShopProduct[]>([])
  const [orders, setOrders] = useState<ShopOrder[]>([])
  const [configs, setConfigs] = useState<PaymentConfig[]>([])
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [webhookSecretLoaded, setWebhookSecretLoaded] = useState(false)
  const [yipayGateway, setYipayGateway] = useState('')
  const [yipayPid, setYipayPid] = useState('')
  const [yipayKey, setYipayKey] = useState('')
  const [wechatAppId, setWechatAppId] = useState('')
  const [wechatMchId, setWechatMchId] = useState('')
  const [wechatApiKey, setWechatApiKey] = useState('')
  const [alipayAppId, setAlipayAppId] = useState('')
  const [alipayPublicKey, setAlipayPublicKey] = useState('')
  const [editingProduct, setEditingProduct] = useState<ShopProduct | null>(null)
  const [editForm, setEditForm] = useState({ name: '', description: '', priceInCents: '', isEnabled: true })
  const [editSaving, setEditSaving] = useState(false)
  const [orderStatusFilter, setOrderStatusFilter] = useState('all')
  const [orderProviderFilter, setOrderProviderFilter] = useState('all')

  // 新建商品表单
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    projectId: '',
    licenseMode: 'TIME',
    cardType: null as string | null,
    validDays: '30',
    totalCount: '',
    priceInCents: '',
    stockMode: 'DYNAMIC',
  })

  useEffect(() => {
    void loadAll()
    void loadProjects()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderStatusFilter, orderProviderFilter])

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
      fetch(`/api/admin/shop/orders?status=${orderStatusFilter}&provider=${orderProviderFilter}`),
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

    // 预填易支付配置
    const yipayConfig = (configData.configs ?? []).find((item) => item.provider === 'yipay')
    if (yipayConfig) {
      try {
        const parsed = JSON.parse(yipayConfig.configJson) as Record<string, string>
        setYipayGateway(parsed.gateway ?? '')
        setYipayPid(parsed.pid ?? '')
        setYipayKey(parsed.key ?? '')
      } catch { /* ignore */ }
    }

    // 预填微信支付配置
    const wechatConfig = (configData.configs ?? []).find((item) => item.provider === 'wechat')
    if (wechatConfig) {
      try {
        const parsed = JSON.parse(wechatConfig.configJson) as Record<string, string>
        setWechatAppId(parsed.appId ?? '')
        setWechatMchId(parsed.mchId ?? '')
        setWechatApiKey(parsed.apiKey ?? '')
      } catch { /* ignore */ }
    }

    // 预填支付宝配置
    const alipayConfig = (configData.configs ?? []).find((item) => item.provider === 'alipay')
    if (alipayConfig) {
      try {
        const parsed = JSON.parse(alipayConfig.configJson) as Record<string, string>
        setAlipayAppId(parsed.appId ?? '')
        setAlipayPublicKey(parsed.alipayPublicKey ?? '')
      } catch { /* ignore */ }
    }
  }

  const handleSaveYipayConfig = async () => {
    try {
      const response = await fetch('/api/admin/shop/payment-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'yipay',
          configJson: JSON.stringify({
            gateway: yipayGateway.trim(),
            pid: yipayPid.trim(),
            key: yipayKey.trim(),
          }),
        }),
      })
      const data = (await response.json()) as { success: boolean; message?: string }
      if (!data.success) { notify(data.message ?? t('shopadmin.saveFailed', '保存失败'), 'error'); return }
      notify(t('shopadmin.yipayConfigSaved', '易支付配置已保存'))
      await loadAll()
    } catch { notify(t('shopadmin.saveFailed', '保存失败'), 'error') }
  }

  const handleSaveWechatConfig = async () => {
    try {
      const response = await fetch('/api/admin/shop/payment-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'wechat',
          configJson: JSON.stringify({
            appId: wechatAppId.trim(),
            mchId: wechatMchId.trim(),
            apiKey: wechatApiKey.trim(),
          }),
        }),
      })
      const data = (await response.json()) as { success: boolean; message?: string }
      if (!data.success) { notify(data.message ?? t('shopadmin.saveFailed', '保存失败'), 'error'); return }
      notify(t('shopadmin.wechatConfigSaved', '微信支付配置已保存'))
      await loadAll()
    } catch { notify(t('shopadmin.saveFailed', '保存失败'), 'error') }
  }

  const handleSaveAlipayConfig = async () => {
    try {
      const response = await fetch('/api/admin/shop/payment-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'alipay',
          configJson: JSON.stringify({
            appId: alipayAppId.trim(),
            alipayPublicKey: alipayPublicKey.trim(),
          }),
        }),
      })
      const data = (await response.json()) as { success: boolean; message?: string }
      if (!data.success) { notify(data.message ?? t('shopadmin.saveFailed', '保存失败'), 'error'); return }
      notify(t('shopadmin.alipayConfigSaved', '支付宝配置已保存'))
      await loadAll()
    } catch { notify(t('shopadmin.saveFailed', '保存失败'), 'error') }
  }

  const handleCreateProduct = async () => {
    if (!newProduct.name || !newProduct.projectId || !newProduct.priceInCents) {
      notify(t('shopadmin.productFieldsRequired', '请填写商品名称、项目与价格'), 'error')
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
          stockMode: newProduct.stockMode === 'PREDEFINED' ? 'PREDEFINED' : 'DYNAMIC',
        }),
      })
      const data = (await response.json()) as { success: boolean; message?: string }
      if (!data.success) {
        notify(data.message ?? t('shopadmin.createFailed', '创建失败'), 'error')
        return
      }
      notify(t('shopadmin.productCreated', '商品创建成功'))
      setNewProduct({ name: '', description: '', projectId: '', licenseMode: 'TIME', cardType: t('shopadmin.cardTypeMonthly', '月卡'), validDays: '30', totalCount: '', priceInCents: '', stockMode: 'DYNAMIC' })
      await loadAll()
    } catch {
      notify(t('shopadmin.createFailed', '创建失败'), 'error')
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
      notify(t('shopadmin.operationFailed', '操作失败'), 'error')
    }
  }

  const handleDeleteProduct = async (product: ShopProduct) => {
    if (!window.confirm(t('shopadmin.deleteProductConfirm', '确定删除商品「{{name}}」吗？').replace('{{name}}', product.name))) return
    try {
      await fetch(`/api/admin/shop/products/${product.id}`, { method: 'DELETE' })
      await loadAll()
    } catch {
      notify(t('shopadmin.deleteFailed', '删除失败'), 'error')
    }
  }

  const handleCleanupExpiredOrders = async () => {
    if (!window.confirm(t('shopadmin.cleanupExpiredConfirm', '取消所有超过 30 分钟仍未支付的待支付订单？'))) return
    try {
      const response = await fetch('/api/admin/shop/orders/cleanup', { method: 'POST' })
      const data = (await response.json()) as { success: boolean; message?: string }
      if (!data.success) { notify(data.message ?? t('shopadmin.cleanupFailed', '清理失败'), 'error'); return }
      notify(data.message ?? t('shopadmin.cleanupDone', '清理完成'))
      await loadAll()
    } catch {
      notify(t('shopadmin.cleanupRetry', '清理失败，请重试'), 'error')
    }
  }

  const handleResendEmail = async (order: ShopOrder) => {
    if (!window.confirm(t('shopadmin.resendEmailConfirm', '向 {{email}} 重发订单 {{orderNo}} 的卡密邮件？').replace('{{email}}', order.contactEmail ?? '').replace('{{orderNo}}', order.orderNo))) return
    try {
      const response = await fetch(`/api/admin/shop/orders/${order.orderNo}/resend-email`, {
        method: 'POST',
      })
      const data = (await response.json()) as { success: boolean; message?: string }
      if (!data.success) {
        notify(data.message ?? t('shopadmin.resendFailed', '重发失败'), 'error')
        return
      }
      notify(data.message ?? t('shopadmin.resendEmailDone', '卡密邮件已重发'))
    } catch {
      notify(t('shopadmin.resendRetry', '重发失败，请重试'), 'error')
    }
  }

  const handleOpenEditProduct = (product: ShopProduct) => {
    setEditingProduct(product)
    setEditForm({
      name: product.name,
      description: product.description ?? '',
      priceInCents: String(product.priceInCents / 100),
      isEnabled: product.isEnabled,
    })
  }

  const handleSaveEditProduct = async () => {
    if (!editingProduct) return
    const price = Number(editForm.priceInCents)
    if (!editForm.name.trim() || !Number.isFinite(price) || price < 0) {
      notify(t('shopadmin.invalidNameOrPrice', '请填写有效的名称与价格'), 'error')
      return
    }
    setEditSaving(true)
    try {
      const response = await fetch(`/api/admin/shop/products/${editingProduct.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim(),
          description: editForm.description.trim() || null,
          priceInCents: Math.round(price * 100),
          isEnabled: editForm.isEnabled,
        }),
      })
      const data = (await response.json()) as { success: boolean; message?: string }
      if (!data.success) { notify(data.message ?? t('shopadmin.saveFailed', '保存失败'), 'error'); return }
      notify(t('shopadmin.productUpdated', '商品已更新'))
      setEditingProduct(null)
      await loadAll()
    } catch {
      notify(t('shopadmin.saveFailed', '保存失败'), 'error')
    } finally {
      setEditSaving(false)
    }
  }

  const handleRestockProduct = async (product: ShopProduct) => {
    const input = window.prompt(t('shopadmin.restockPrompt', '为「{{name}}」补充多少张预定义激活码？（1-100）').replace('{{name}}', product.name), '10')
    if (input === null) return
    const amount = Number(input)
    if (!Number.isInteger(amount) || amount < 1 || amount > 100) {
      notify(t('shopadmin.restockRangeInvalid', '请输入 1-200 之间的整数'), 'error')
      return
    }
    try {
      const response = await fetch('/api/admin/shop/products/restock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, amount }),
      })
      const data = (await response.json()) as { success: boolean; message?: string }
      if (!data.success) { notify(data.message ?? t('shopadmin.restockFailed', '补货失败'), 'error'); return }
      notify(t('shopadmin.restockDone', '已补充 {{amount}} 张激活码到码池').replace('{{amount}}', String(amount)))
      await loadAll()
    } catch {
      notify(t('shopadmin.restockFailed', '补货失败'), 'error')
    }
  }

  const handleConfirmOrder = async (order: ShopOrder) => {
    if (!window.confirm(t('shopadmin.confirmOrderPrompt', '确认订单 {{orderNo}} 已收款并发放卡密？').replace('{{orderNo}}', order.orderNo))) return
    try {
      const response = await fetch(`/api/admin/shop/orders/${order.orderNo}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: order.paymentNote ?? undefined }),
      })
      const data = (await response.json()) as { success: boolean; message?: string }
      if (!data.success) {
        notify(data.message ?? t('shopadmin.confirmFailed', '确认失败'), 'error')
        return
      }
      notify(t('shopadmin.confirmedAndFulfilled', '已确认收款并发放卡密'))
      await loadAll()
    } catch {
      notify(t('shopadmin.operationFailed', '操作失败'), 'error')
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
        notify(data.message ?? t('shopadmin.saveFailed', '保存失败'), 'error')
        return
      }
      notify(t('shopadmin.webhookSecretSaved', '回调密钥已保存'))
      await loadAll()
    } catch {
      notify(t('shopadmin.saveFailed', '保存失败'), 'error')
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
      notify(t('shopadmin.operationFailed', '操作失败'), 'error')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        {(
          [
            ['products', t('shopadmin.tabProducts', '商品管理')],
            ['orders', t('shopadmin.tabOrders', '订单管理')],
            ['channels', t('shopadmin.tabChannels', '支付渠道')],
          ] as Array<[ShopAdminTab, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition ${
              tab === key
                ? 'bg-primary text-white shadow-glow'
                : 'border border-border bg-card text-foreground/80 hover:text-foreground'
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
            <h3 className="text-lg font-semibold text-foreground">{t('shopadmin.newProduct', '新建商品')}</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {t('shopadmin.newProductDesc', '商品绑定项目 + 授权套餐，买家下单支付后自动发放卡密。')}
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <AppInput
                value={newProduct.name}
                onChange={(event) => setNewProduct({ ...newProduct, name: event.target.value })}
                placeholder={t('shopadmin.productNamePlaceholder', '商品名称（如 月卡）')}
              />
              <AppInput
                value={newProduct.description}
                onChange={(event) => setNewProduct({ ...newProduct, description: event.target.value })}
                placeholder={t('shopadmin.productDescPlaceholder', '商品描述（可选）')}
              />
              <AppSelect
                value={newProduct.projectId}
                onChange={(event) => setNewProduct({ ...newProduct, projectId: event.target.value })}
              >
                <option value="">{t('shopadmin.selectProject', '选择项目')}</option>
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
                <option value="TIME">{t('shopadmin.licenseModeTime', '时间型')}</option>
                <option value="COUNT">{t('shopadmin.licenseModeCount', '次数型')}</option>
              </AppSelect>
              {newProduct.licenseMode === 'TIME' ? (
                <>
                  <AppInput
                    value={newProduct.cardType ?? ''}
                    onChange={(event) => setNewProduct({ ...newProduct, cardType: event.target.value })}
                    placeholder={t('shopadmin.cardTypePlaceholder', '套餐类型（如 月卡）')}
                  />
                  <AppInput
                    type="number"
                    value={newProduct.validDays}
                    onChange={(event) => setNewProduct({ ...newProduct, validDays: event.target.value })}
                    placeholder={t('shopadmin.validDaysPlaceholder', '有效期（天）')}
                  />
                </>
              ) : (
                <AppInput
                  type="number"
                  value={newProduct.totalCount}
                  onChange={(event) => setNewProduct({ ...newProduct, totalCount: event.target.value })}
                  placeholder={t('shopadmin.totalCountPlaceholder', '总次数')}
                />
              )}
              <AppInput
                type="number"
                step="0.01"
                value={newProduct.priceInCents}
                onChange={(event) => setNewProduct({ ...newProduct, priceInCents: event.target.value })}
                placeholder={t('shopadmin.pricePlaceholder', '价格（元）')}
              />
              <AppSelect
                value={newProduct.stockMode}
                onChange={(event) => setNewProduct({ ...newProduct, stockMode: event.target.value })}
              >
                <option value="DYNAMIC">{t('shopadmin.stockModeDynamic', '动态生成（下单后发新码）')}</option>
                <option value="PREDEFINED">{t('shopadmin.stockModePredefined', '预定义码池（卖预存码）')}</option>
              </AppSelect>
              <button
                type="button"
                onClick={() => void handleCreateProduct()}
                className="inline-flex items-center justify-center rounded-md bg-gradient-to-r from-primary via-primary to-primary px-4 py-2.5 text-sm font-medium text-white shadow-glow transition hover:from-primary/90 hover:via-primary/90 hover:to-primary/90"
              >
                {t('shopadmin.createProduct', '创建商品')}
              </button>
            </div>
          </div>

          <div className={`${panelClassName} p-6`}>
            <h3 className="text-lg font-semibold text-foreground">{t('shopadmin.productsOnSale', '在售商品')}</h3>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    <th className="py-2 pr-4">{t('shopadmin.colName', '名称')}</th>
                    <th className="py-2 pr-4">{t('shopadmin.colProject', '项目')}</th>
                    <th className="py-2 pr-4">{t('shopadmin.colType', '类型')}</th>
                    <th className="py-2 pr-4">{t('shopadmin.colSpec', '规格')}</th>
                    <th className="py-2 pr-4">{t('shopadmin.colPrice', '价格')}</th>
                    <th className="py-2 pr-4">{t('shopadmin.colStatus', '状态')}</th>
                    <th className="py-2 pr-4">{t('shopadmin.colActions', '操作')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-200">
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td className="py-3 pr-4 font-medium text-foreground">{product.name}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{product.projectKey}</td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {product.licenseMode === 'TIME' ? t('shopadmin.licenseModeTime', '时间型') : t('shopadmin.licenseModeCount', '次数型')}
                        <span
                          className={`ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            product.stockMode === 'PREDEFINED'
                              ? 'bg-primary/10 text-primary'
                              : 'bg-card text-muted-foreground'
                          }`}
                        >
                          {product.stockMode === 'PREDEFINED' ? t('shopadmin.predefinedBadge', '预存码') : t('shopadmin.dynamicBadge', '动态')}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {product.licenseMode === 'TIME'
                          ? t('shopadmin.specTime', '{{cardType}}（{{days}} 天）').replace('{{cardType}}', product.cardType ?? '-').replace('{{days}}', String(product.validDays ?? '-'))
                          : t('shopadmin.specCount', '{{count}} 次').replace('{{count}}', String(product.totalCount ?? '-'))}
                      </td>
                      <td className="py-3 pr-4 font-semibold text-primary">
                        {formatPrice(product.priceInCents)}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={product.isEnabled ? 'text-emerald-400' : 'text-muted-foreground'}>
                          {product.isEnabled ? t('shopadmin.onSale', '在售') : t('shopadmin.offSale', '已下架')}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void handleToggleProduct(product)}
                            className="rounded-md border border-border bg-card px-2.5 py-1 text-xs text-foreground/80 hover:text-foreground"
                          >
                            {product.isEnabled ? t('shopadmin.takeOffSale', '下架') : t('shopadmin.putOnSale', '上架')}
                          </button>
                          {product.stockMode === 'PREDEFINED' ? (
                            <button
                              type="button"
                              onClick={() => void handleRestockProduct(product)}
                              className="rounded-md border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs text-primary"
                            >
                              {t('shopadmin.restock', '补货')}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => handleOpenEditProduct(product)}
                            className="rounded-md border border-border bg-card px-2.5 py-1 text-xs text-foreground/80 hover:text-foreground"
                          >
                            {t('shopadmin.edit', '编辑')}
                          </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteProduct(product)}
                              className="rounded-md border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-xs text-rose-400"
                            >
                              {t('shopadmin.delete', '删除')}
                            </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-muted-foreground">
                        {t('shopadmin.noProducts', '暂无商品，请先创建')}
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
          <h3 className="text-lg font-semibold text-foreground">{t('shopadmin.tabOrders', '订单管理')}</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {t('shopadmin.ordersDesc', 'manual 渠道需人工核对收款后点击确认，系统自动发放卡密。')}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleCleanupExpiredOrders()}
              className="rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-400"
            >
              {t('shopadmin.cleanupExpiredButton', '清理超时订单（30 分钟未支付）')}
            </button>
            <AppSelect
              value={orderStatusFilter}
              onChange={(event) => setOrderStatusFilter(event.target.value)}
              className="w-40"
            >
              <option value="all">{t('shopadmin.allStatuses', '全部状态')}</option>
              <option value="pending">{t('shopadmin.statusPending', '待支付')}</option>
              <option value="paid">{t('shopadmin.statusPaid', '已支付')}</option>
              <option value="fulfilled">{t('shopadmin.statusFulfilled', '已发卡')}</option>
              <option value="cancelled">{t('shopadmin.statusCancelled', '已取消')}</option>
            </AppSelect>
            <AppSelect
              value={orderProviderFilter}
              onChange={(event) => setOrderProviderFilter(event.target.value)}
              className="w-44"
            >
              <option value="all">{t('shopadmin.allChannels', '全部渠道')}</option>
              <option value="manual">{t('shopadmin.channelManualShort', '手动收款')}</option>
              <option value="yipay">{t('shopadmin.channelYipay', '易支付')}</option>
              <option value="wechat">{t('shopadmin.channelWechat', '微信支付')}</option>
              <option value="alipay">{t('shopadmin.channelAlipay', '支付宝')}</option>
              <option value="webhook">{t('shopadmin.channelWebhookShort', '通用回调')}</option>
            </AppSelect>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  <th className="py-2 pr-4">{t('shopadmin.colOrderNo', '订单号')}</th>
                  <th className="py-2 pr-4">{t('shopadmin.colProduct', '商品')}</th>
                  <th className="py-2 pr-4">{t('shopadmin.colAmount', '金额')}</th>
                  <th className="py-2 pr-4">{t('shopadmin.colStatus', '状态')}</th>
                  <th className="py-2 pr-4">{t('shopadmin.colContact', '联系方式')}</th>
                  <th className="py-2 pr-4">{t('shopadmin.colPaymentNote', '支付备注')}</th>
                  <th className="py-2 pr-4">{t('shopadmin.colCreatedAt', '创建时间')}</th>
                  <th className="py-2 pr-4">{t('shopadmin.colActions', '操作')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200">
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="py-3 pr-4 font-mono text-xs text-foreground/80">{order.orderNo}</td>
                    <td className="py-3 pr-4 text-foreground">
                      {order.productName}
                      {(order.quantity ?? 1) > 1 ? (
                        <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-xs text-foreground/80">
                          ×{order.quantity}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3 pr-4 font-semibold text-foreground">
                      {formatPrice(order.amountInCents)}
                    </td>
                    <td className={`py-3 pr-4 font-medium ${statusToneMap[order.status] ?? ''}`}>
                      {statusLabelMap[order.status]
                        ? t(statusLabelMap[order.status][0], statusLabelMap[order.status][1])
                        : order.status}
                    </td>
                    <td className="py-3 pr-4 text-xs text-muted-foreground">
                      {[order.contactEmail, order.contactPhone, order.contactWechat]
                        .filter(Boolean)
                        .join(' / ') || '-'}
                    </td>
                    <td className="py-3 pr-4 text-xs text-muted-foreground">{order.paymentNote ?? '-'}</td>
                    <td className="py-3 pr-4 text-xs text-muted-foreground">
                      {new Date(order.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 pr-4">
                      {order.status === 'pending' ? (
                        <button
                          type="button"
                          onClick={() => void handleConfirmOrder(order)}
                          className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-400"
                        >
                          {t('shopadmin.confirmAndFulfill', '确认收款发卡')}
                        </button>
                      ) : order.status === 'fulfilled' ? (
                        <div className="flex flex-col gap-1.5">
                          <span className="text-xs text-emerald-400">{t('shopadmin.fulfilledBadge', '✓ 已发卡')}</span>
                          {order.contactEmail ? (
                            <button
                              type="button"
                              onClick={() => void handleResendEmail(order)}
                              className="rounded-md border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-xs text-sky-400"
                            >
                              {t('shopadmin.resendEmailButton', '重发卡密邮件')}
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground">
                      {t('shopadmin.noOrders', '暂无订单')}
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
          <h3 className="text-lg font-semibold text-foreground">{t('shopadmin.tabChannels', '支付渠道')}</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {t('shopadmin.channelsDesc', '启用渠道后，买家可在下单页选择该支付方式。')}
          </p>
          <div className="mt-4 space-y-3">
            {configs.map((config) => (
              <div
                key={config.provider}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3"
              >
                <div>
                  <div className="text-sm font-medium text-foreground">
                    {config.provider === 'manual'
                      ? t('shop.channel.manual', '手动收款确认')
                      : config.provider === 'webhook'
                        ? t('shop.channel.webhook', '通用支付回调')
                        : config.provider === 'yipay'
                          ? t('shop.channel.yipay', '易支付')
                          : config.provider === 'wechat'
                            ? t('shop.channel.wechat', '微信支付（官方）')
                            : config.provider === 'alipay'
                              ? t('shop.channel.alipay', '支付宝（官方）')
                              : config.provider}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {config.provider === 'manual'
                      ? t('shopadmin.channelDescManual', '展示收款信息，管理员人工确认后发卡')
                      : config.provider === 'webhook'
                        ? t('shopadmin.channelDescWebhook', '自建服务回调 POST /api/shop/payment/webhook 触发发卡')
                        : config.provider === 'yipay'
                          ? t('shopadmin.channelDescYipay', '个人可用，通过易支付聚合通道接入微信/支付宝扫码支付')
                          : config.provider === 'wechat'
                            ? t('shopadmin.channelDescWechat', '需微信商户号，Native 扫码支付')
                            : config.provider === 'alipay'
                              ? t('shopadmin.channelDescAlipay', '需支付宝商户资质，扫码支付')
                              : config.provider}
                    {config.isEnabled && config.configComplete === false ? (
                      <span className="ml-1.5 font-medium text-amber-400">
                        {t('shopadmin.configIncomplete', '配置不完整（缺 {{keys}}），购买页不展示').replace('{{keys}}', config.missingKeys?.join(', ') ?? '')}
                      </span>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleToggleChannel(config)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    config.isEnabled
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'border border-border bg-card text-foreground/80'
                  }`}
                >
                  {config.isEnabled ? t('shopadmin.channelEnabled', '已启用') : t('shopadmin.channelDisabled', '未启用')}
                </button>
              </div>
            ))}
            {webhookSecretLoaded ? (
              <div className="rounded-lg border border-border bg-muted/50 px-4 py-4">
                <div className="text-sm font-medium text-foreground">{t('shopadmin.webhookSecretTitle', '通用回调密钥（webhook）')}</div>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                  {t('shopadmin.webhookSecretDesc', '配置后，回调请求必须携带 x-webhook-secret 请求头且值匹配，否则拒绝（防止未授权调用触发免费发卡）。留空则不校验。')}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <AppInput
                    value={webhookSecret}
                    onChange={(event) => setWebhookSecret(event.target.value)}
                    placeholder={t('shopadmin.webhookSecretPlaceholder', '输入回调密钥（留空不校验）')}
                    className="max-w-sm"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSaveWebhookSecret()}
                    className="rounded-md border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
                  >
                    {t('shopadmin.saveSecret', '保存密钥')}
                  </button>
                </div>
              </div>
            ) : null}
            {configs.find((c) => c.provider === 'yipay') ? (
              <div className="rounded-lg border border-border bg-muted/50 px-4 py-4">
                <div className="text-sm font-medium text-foreground">{t('shopadmin.yipayConfigTitle', '易支付配置')}</div>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                  {t('shopadmin.yipayConfigDesc', '配置易支付网关地址、商户PID和密钥，回调地址为 /api/shop/payment/yipay')}
                </p>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <AppInput
                    value={yipayGateway}
                    onChange={(e) => setYipayGateway(e.target.value)}
                    placeholder={t('shopadmin.yipayGatewayPlaceholder', '网关地址 https://pay.example.com')}
                    className="max-w-sm"
                  />
                  <AppInput
                    value={yipayPid}
                    onChange={(e) => setYipayPid(e.target.value)}
                    placeholder={t('shopadmin.yipayPidPlaceholder', '商户PID')}
                    className="max-w-sm"
                  />
                  <AppInput
                    value={yipayKey}
                    onChange={(e) => setYipayKey(e.target.value)}
                    placeholder={t('shopadmin.yipayKeyPlaceholder', '商户密钥')}
                    className="max-w-sm"
                  />
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSaveYipayConfig()}
                    className="rounded-md border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
                  >
                    {t('shopadmin.saveConfig', '保存配置')}
                  </button>
                </div>
              </div>
            ) : null}
            {configs.find((c) => c.provider === 'wechat') ? (
              <div className="rounded-lg border border-border bg-muted/50 px-4 py-4">
                <div className="text-sm font-medium text-foreground">{t('shopadmin.wechatConfigTitle', '微信支付配置')}</div>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                  {t('shopadmin.wechatConfigDesc', '需微信商户号，回调地址为 /api/shop/payment/wechat')}
                </p>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <AppInput
                    value={wechatAppId}
                    onChange={(e) => setWechatAppId(e.target.value)}
                    placeholder={t('shopadmin.wechatAppIdPlaceholder', '公众号AppId')}
                    className="max-w-sm"
                  />
                  <AppInput
                    value={wechatMchId}
                    onChange={(e) => setWechatMchId(e.target.value)}
                    placeholder={t('shopadmin.wechatMchIdPlaceholder', '商户号MchId')}
                    className="max-w-sm"
                  />
                  <AppInput
                    value={wechatApiKey}
                    onChange={(e) => setWechatApiKey(e.target.value)}
                    placeholder={t('shopadmin.wechatApiKeyPlaceholder', 'API密钥')}
                    className="max-w-sm"
                  />
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSaveWechatConfig()}
                    className="rounded-md border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
                  >
                    {t('shopadmin.saveConfig', '保存配置')}
                  </button>
                </div>
              </div>
            ) : null}
            {configs.find((c) => c.provider === 'alipay') ? (
              <div className="rounded-lg border border-border bg-muted/50 px-4 py-4">
                <div className="text-sm font-medium text-foreground">{t('shopadmin.alipayConfigTitle', '支付宝配置')}</div>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                  {t('shopadmin.alipayConfigDesc', '需支付宝商户资质，回调地址为 /api/shop/payment/alipay')}
                </p>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <AppInput
                    value={alipayAppId}
                    onChange={(e) => setAlipayAppId(e.target.value)}
                    placeholder={t('shopadmin.alipayAppIdPlaceholder', '应用AppId')}
                    className="max-w-sm"
                  />
                  <AppInput
                    value={alipayPublicKey}
                    onChange={(e) => setAlipayPublicKey(e.target.value)}
                    placeholder={t('shopadmin.alipayPublicKeyPlaceholder', '支付宝公钥')}
                    className="max-w-sm"
                  />
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSaveAlipayConfig()}
                    className="rounded-md border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
                  >
                    {t('shopadmin.saveConfig', '保存配置')}
                  </button>
                </div>
              </div>
            ) : null}
            {configs.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t('shopadmin.noChannelConfigs', '暂无支付渠道配置')}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* 商品编辑弹框 */}
      <DashboardModal
        open={editingProduct !== null}
        onClose={() => setEditingProduct(null)}
        title={t('shopadmin.editProductTitle', '编辑商品')}
        description={editingProduct ? t('shopadmin.editProductDesc', '修改「{{name}}」的名称、描述与价格').replace('{{name}}', editingProduct.name) : ''}
        size="xl"
        footer={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setEditingProduct(null)}
              className="rounded-md border border-border bg-card px-4 py-2 text-sm text-foreground/80 hover:text-foreground"
            >
              {t('common.cancel', '取消')}
            </button>
            <button
              type="button"
              onClick={() => void handleSaveEditProduct()}
              disabled={editSaving}
              className="rounded-md bg-gradient-to-r from-primary via-primary to-primary px-4 py-2 text-sm font-medium text-white shadow-glow transition hover:from-primary/90 hover:via-primary/90 hover:to-primary/90 disabled:opacity-50"
            >
              {editSaving ? t('shopadmin.saving', '保存中…') : t('shopadmin.saveChanges', '保存修改')}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground/90">{t('shopadmin.productNameLabel', '商品名称')}</label>
            <AppInput
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              placeholder={t('shopadmin.productNamePlaceholderShort', '商品名称')}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground/90">{t('shopadmin.productDescLabel', '商品描述')}</label>
            <AppInput
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              placeholder={t('shopadmin.productDescPlaceholder', '商品描述（可选）')}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground/90">{t('shopadmin.priceLabel', '价格（元）')}</label>
            <AppInput
              type="number"
              step="0.01"
              value={editForm.priceInCents}
              onChange={(e) => setEditForm({ ...editForm, priceInCents: e.target.value })}
              placeholder={t('shopadmin.pricePlaceholder', '价格（元）')}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground/80">
            <input
              type="checkbox"
              checked={editForm.isEnabled}
              onChange={(e) => setEditForm({ ...editForm, isEnabled: e.target.checked })}
              className="h-4 w-4 rounded border-input"
            />
            {t('shopadmin.listForSale', '上架销售')}
          </label>
        </div>
      </DashboardModal>
    </div>
  )
}
