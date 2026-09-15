/**
 * shop-admin-data 行为测试：mock fetch 逐个覆盖数据层函数。
 */
import './helpers/dom'
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  cleanupExpiredShopOrders,
  confirmShopOrder,
  createShopProduct,
  deleteShopProduct,
  fetchShopOrders,
  fetchShopPaymentConfigs,
  fetchShopProducts,
  fetchShopProjects,
  formatPrice,
  getShopOrderStatusLabel,
  getShopOrderStatusTone,
  parseProviderConfig,
  resendShopOrderEmail,
  restockShopProduct,
  saveShopPaymentConfig,
  updateShopProduct,
} from '../src/lib/shop-admin-data'

function ok(body: unknown) {
  return { ok: true, status: 200, json: async () => body }
}

test('shop-admin-data：读操作走正确端点并透传数据', async () => {
  const calls: string[] = []
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input.toString()
    calls.push(url)
    if (url.includes('/api/admin/shop/orders/cleanup')) return ok({ success: true, message: '清理完成' })
    if (url.includes('/api/admin/shop/orders')) return ok({ orders: [{ id: 1, orderNo: 'SO1' }] })
    if (url.includes('/api/admin/shop/products/restock')) return ok({ success: true })
    if (url.includes('/api/admin/shop/products')) return ok({ products: [{ id: 2, name: 'p' }] })
    if (url.includes('/api/admin/shop/payment-configs')) {
      return ok({ configs: [{ provider: 'webhook', configJson: '{"secret":"s"}', isEnabled: true }] })
    }
    if (url.includes('/api/admin/projects')) return ok({ projects: [{ id: 3, projectKey: 'k', name: 'n' }] })
    return ok({ success: true })
  }) as unknown as typeof fetch

  const products = await fetchShopProducts()
  assert.equal(products[0]?.name, 'p')
  const orders = await fetchShopOrders('paid', 'webhook')
  assert.equal(orders[0]?.orderNo, 'SO1')
  assert.match(calls.find((c) => c.includes('orders'))!, /status=paid&provider=webhook/)
  const configs = await fetchShopPaymentConfigs()
  assert.equal(configs[0]?.provider, 'webhook')
  const projects = await fetchShopProjects()
  assert.equal(projects[0]?.projectKey, 'k')

  await createShopProduct({ name: 'x', projectId: 1, licenseMode: 'TIME', priceInCents: 100, stockMode: 'DYNAMIC' })
  await updateShopProduct(5, { isEnabled: false })
  await deleteShopProduct(5)
  await restockShopProduct(5, 10)
  await saveShopPaymentConfig({ provider: 'yipay', configJson: '{}' })
  await confirmShopOrder('SO9', 'tx1')
  await resendShopOrderEmail('SO9')
  const cleaned = await cleanupExpiredShopOrders()
  assert.equal(cleaned.message, '清理完成')

  const all = JSON.stringify(calls)
  assert.match(all, /products\/5/, 'PATCH/DELETE 应带商品 id')
  assert.match(all, /orders\/SO9\/confirm/)
  assert.match(all, /orders\/SO9\/resend-email/)
  assert.match(all, /orders\/cleanup/)
})

test('shop-admin-data：网络异常回退为失败结果而非抛错', async () => {
  globalThis.fetch = (async () => {
    throw new Error('boom')
  }) as unknown as typeof fetch
  const result = await fetchShopProducts()
  assert.deepEqual(result, [])
  const action = await cleanupExpiredShopOrders()
  assert.equal(action.success, false)
  const orders = await fetchShopOrders()
  assert.deepEqual(orders, [])
  const configs = await fetchShopPaymentConfigs()
  assert.deepEqual(configs, [])
  const projects = await fetchShopProjects()
  assert.deepEqual(projects, [])
})

test('shop-admin-data：展示工具', () => {
  assert.equal(formatPrice(1250), '¥12.50')
  assert.equal(getShopOrderStatusLabel('pending'), '待支付')
  assert.equal(getShopOrderStatusLabel('fulfilled'), '已发卡')
  assert.equal(getShopOrderStatusLabel('unknown-x'), 'unknown-x')
  assert.match(getShopOrderStatusTone('fulfilled'), /emerald/)
  assert.match(getShopOrderStatusTone('pending'), /amber/)
  assert.match(getShopOrderStatusTone('cancelled'), /muted/)
  assert.deepEqual(parseProviderConfig(''), {})
  assert.deepEqual(parseProviderConfig('not-json'), {})
  assert.equal(parseProviderConfig('{"gateway":"https://x"}').gateway, 'https://x')
})
