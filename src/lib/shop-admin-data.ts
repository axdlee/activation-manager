import type { LicenseModeValue } from './license-status'

// ── 类型（与 API 契约一致）──────────────────────────────────

export type ShopProduct = {
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

export type ShopOrder = {
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

export type ShopPaymentConfig = {
  provider: string
  configJson: string
  isEnabled: boolean
  requiredConfigKeys?: string[]
  missingKeys?: string[]
  configComplete?: boolean
}

export type ShopProjectOption = { id: number; projectKey: string; name: string }

export type ShopActionResult = { success: boolean; message?: string }

// ── 展示工具 ────────────────────────────────────────────────

export function formatPrice(cents: number) {
  return `¥${(cents / 100).toFixed(2)}`
}

export const SHOP_ORDER_STATUSES: Array<{ value: string; label: string }> = [
  { value: 'all', label: '全部状态' },
  { value: 'pending', label: '待支付' },
  { value: 'paid', label: '已支付' },
  { value: 'fulfilled', label: '已发卡' },
  { value: 'cancelled', label: '已取消' },
]

export function getShopOrderStatusLabel(status: string) {
  return SHOP_ORDER_STATUSES.find((item) => item.value === status)?.label ?? status
}

export function getShopOrderStatusTone(status: string) {
  if (status === 'fulfilled') return 'bg-emerald-500/10 text-emerald-600'
  if (status === 'paid') return 'bg-blue-500/10 text-blue-600'
  if (status === 'pending') return 'bg-amber-500/10 text-amber-600'
  return 'bg-muted text-muted-foreground'
}

export const SHOP_PAYMENT_PROVIDERS: Array<{ provider: string; name: string }> = [
  { provider: 'webhook', name: 'Webhook 回调' },
  { provider: 'yipay', name: '易支付' },
  { provider: 'wechat', name: '微信支付' },
  { provider: 'alipay', name: '支付宝' },
]

/** 安全解析渠道 configJson；解析失败返回空对象。 */
export function parseProviderConfig(configJson: string | undefined | null): Record<string, string> {
  if (!configJson) return {}
  try {
    return JSON.parse(configJson) as Record<string, string>
  } catch {
    return {}
  }
}

// ── 数据加载 ────────────────────────────────────────────────

export async function fetchShopProducts(): Promise<ShopProduct[]> {
  try {
    const response = await fetch('/api/admin/shop/products')
    const data = (await response.json()) as { products?: ShopProduct[] }
    return data.products ?? []
  } catch {
    return []
  }
}

export async function fetchShopOrders(status = 'all', provider = 'all'): Promise<ShopOrder[]> {
  try {
    const response = await fetch(`/api/admin/shop/orders?status=${status}&provider=${provider}`)
    const data = (await response.json()) as { orders?: ShopOrder[] }
    return data.orders ?? []
  } catch {
    return []
  }
}

export async function fetchShopPaymentConfigs(): Promise<ShopPaymentConfig[]> {
  try {
    const response = await fetch('/api/admin/shop/payment-configs')
    const data = (await response.json()) as { configs?: ShopPaymentConfig[] }
    return data.configs ?? []
  } catch {
    return []
  }
}

export async function fetchShopProjects(): Promise<ShopProjectOption[]> {
  try {
    const response = await fetch('/api/admin/projects')
    const data = (await response.json()) as { projects?: ShopProjectOption[] }
    return data.projects ?? []
  } catch {
    return []
  }
}

// ── 变更操作（保持 API 契约不变）────────────────────────────

async function postJson(url: string, body: unknown, method = 'POST'): Promise<ShopActionResult> {
  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = (await response.json()) as ShopActionResult
    return data
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : '网络错误，请重试' }
  }
}

export type CreateShopProductPayload = {
  name: string
  description?: string
  projectId: number
  licenseMode: LicenseModeValue | string
  cardType?: string | null
  validDays?: number | null
  totalCount?: number | null
  priceInCents: number
  stockMode: string
}

export function createShopProduct(payload: CreateShopProductPayload) {
  return postJson('/api/admin/shop/products', payload)
}

export function updateShopProduct(id: number, payload: Partial<ShopProduct>) {
  return postJson(`/api/admin/shop/products/${id}`, payload, 'PATCH')
}

export function deleteShopProduct(id: number) {
  return postJson(`/api/admin/shop/products/${id}`, undefined, 'DELETE').then((result) => {
    // DELETE 无 body 时按成功处理
    return result ?? { success: true }
  })
}

export function restockShopProduct(productId: number, amount: number) {
  return postJson('/api/admin/shop/products/restock', { productId, amount })
}

export function saveShopPaymentConfig(payload: {
  provider: string
  configJson?: string
  isEnabled?: boolean
}) {
  return postJson('/api/admin/shop/payment-configs', payload)
}

export function confirmShopOrder(orderNo: string, transactionId?: string) {
  return postJson(`/api/admin/shop/orders/${orderNo}/confirm`, { transactionId })
}

export function resendShopOrderEmail(orderNo: string) {
  return postJson(`/api/admin/shop/orders/${orderNo}/resend-email`, {})
}

export function cancelShopOrder(orderNo: string) {
  return postJson(`/api/admin/shop/orders/${orderNo}/cancel`, {})
}

export function cleanupExpiredShopOrders() {
  return postJson('/api/admin/shop/orders/cleanup', {})
}
