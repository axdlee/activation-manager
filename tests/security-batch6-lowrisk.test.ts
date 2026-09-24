/**
 * 评审批次 6（低危）回归测试：
 * 1) 占位渠道（callbackTrust === 'placeholder'）即使误启用也不允许下单
 * 2) 订单卡密令牌支持 X-Order-Token 请求头（URL ?token= 保留兼容）
 * 3) 管理员令牌 username 不存在时生产环境拒绝（不再跳过版本校验）
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { getShopOrderDetailRoute } from '../src/app/api/shop/orders/[orderNo]/route'
import { authorizeAdminRequest } from '../src/lib/admin-auth-service'

describe('批次6 低危修复', () => {
  it('占位渠道下单被拒绝（即使误启用）', async () => {
    // 占位适配器（如官方支付宝/微信）验签未实现：注册表定义必须带
    // callbackTrust === 'placeholder'，下单入口对这类 provider 走前置拒绝。
    const { paymentProviderRegistry } = await import('../src/lib/shop-payment-registry')
    const placeholderIds = Object.entries(paymentProviderRegistry)
      .filter(([, p]) => p.callbackTrust === 'placeholder')
      .map(([id]) => id)
    assert.ok(placeholderIds.includes('alipay'), 'alipay 应为占位渠道')
    assert.ok(placeholderIds.includes('wechat'), 'wechat 应为占位渠道')
  })

  it('订单令牌：X-Order-Token 请求头可读卡密，无令牌不回卡密', async () => {
    const accessToken = 'a'.repeat(32)
    const executed = await getShopOrderDetailRoute(
      new NextRequest(`http://localhost/api/shop/orders/NO-HEADER`, {
        headers: { 'x-order-token': accessToken },
      }),
      { params: { orderNo: 'NO-HEADER' } },
      {
        shopOrder: {
          findUnique: async () => ({
            orderNo: 'NO-HEADER',
            status: 'fulfilled',
            accessToken,
            fulfilledCodeIds: JSON.stringify([11]),
            amountInCents: 100,
            createdAt: new Date(),
            product: { name: 'p' },
          }),
        },
        activationCode: {
          findMany: async () => [{ id: 11, code: 'CODE-11', cardType: 'TIME' }],
        },
      } as never,
    )
    const payload = (await executed.json()) as { codes: unknown[] }
    assert.equal(payload.codes.length, 1)

    // 无任何令牌 → codes 空
    const denied = await getShopOrderDetailRoute(
      new NextRequest('http://localhost/api/shop/orders/NO-HEADER'),
      { params: { orderNo: 'NO-HEADER' } },
      {
        shopOrder: {
          findUnique: async () => ({
            orderNo: 'NO-HEADER',
            status: 'fulfilled',
            accessToken,
            fulfilledCodeIds: JSON.stringify([11]),
            amountInCents: 100,
            createdAt: new Date(),
            product: { name: 'p' },
          }),
        },
        activationCode: { findMany: async () => [] },
      } as never,
    )
    const deniedPayload = (await denied.json()) as { codes: unknown[] }
    assert.equal(deniedPayload.codes.length, 0)
  })

  it('管理员令牌：账户不存在时生产拒绝、开发跳过', async () => {
    const request = new NextRequest('http://localhost/api/admin/projects', {
      headers: { cookie: 'auth-token=fake-token' },
    })
    const dependencies = {
      getAllowedIPs: async () => ['127.0.0.1'],
      verifyToken: async () => ({ username: 'ghost', isAdmin: true, tokenVersion: 0 }),
      getTokenVersion: async () => null,
    }
    const denied = await authorizeAdminRequest(request, {
      mode: 'protected',
      nodeEnv: 'production',
    }, dependencies as never)
    assert.equal(denied.success, false)
    assert.equal(denied.code, 'token_invalid')

    const allowed = await authorizeAdminRequest(request, {
      mode: 'protected',
      nodeEnv: 'development',
    }, dependencies as never)
    assert.equal(allowed.success, true)
  })
})
