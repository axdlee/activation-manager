import { expect, test } from '@playwright/test'

// =============================================================
// 支付适配器回调 e2e：验证易支付/微信/支付宝回调路由
// 可在无真实商户资质的情况下用 mock 回调验证全链路
// =============================================================

test.describe.serial('支付适配器回调 e2e', () => {
  let adminCookie: string
  let productId: number
  let orderNo: string

  test('0. 后台创建商品并启用易支付渠道', async ({ request }) => {
    // 登录拿 cookie
    const loginRes = await request.post('/api/admin/login', {
      data: { username: 'admin', password: '123456' },
    })
    expect(loginRes.status()).toBe(200)
    const setCookie = loginRes.headers()['set-cookie'] || ''
    adminCookie = setCookie.split(';')[0] || ''

    // 启用易支付渠道
    const configRes = await request.post('/api/admin/shop/payment-configs', {
      headers: { cookie: adminCookie },
      data: {
        provider: 'yipay',
        configJson: JSON.stringify({
          gateway: 'https://pay.example.com',
          pid: 'test-pid',
          key: 'test-key',
        }),
        isEnabled: true,
      },
    })
    expect(configRes.status()).toBe(200)

    // 创建商品
    const productRes = await request.post('/api/admin/shop/products', {
      headers: { cookie: adminCookie },
      data: {
        name: 'e2e-月卡',
        projectId: 1,
        licenseMode: 'TIME',
        cardType: '月卡',
        validDays: 30,
        priceInCents: 1000,
      },
    })
    const productData = (await productRes.json()) as { success: boolean; product?: { id: number } }
    expect(productData.success).toBe(true)
    productId = productData.product?.id ?? 0
    expect(productId).toBeGreaterThan(0)
  })

  test('1. 公开下单后易支付回调触发自动发卡', async ({ request }) => {
    expect(productId).toBeGreaterThan(0)

    // 下单
    const orderRes = await request.post('/api/shop/orders', {
      data: {
        productId,
        providerId: 'yipay',
        contactEmail: 'e2e-yipay@example.com',
      },
    })
    const orderData = (await orderRes.json()) as { success: boolean; order?: { orderNo: string } }
    expect(orderData.success).toBe(true)
    orderNo = orderData.order?.orderNo ?? ''
    expect(orderNo).toMatch(/^SO[A-Z0-9]+$/)

    // 模拟易支付回调（form-urlencoded 格式）
    const { createHash } = await import('node:crypto')
    const params: Record<string, string> = {
      out_trade_no: orderNo,
      trade_no: 'YIPAY-E2E-001',
      trade_status: 'TRADE_SUCCESS',
      pid: 'test-pid',
      money: '10.00',
      name: 'e2e-月卡',
    }
    const sorted = Object.keys(params)
      .sort()
      .filter((k) => params[k] !== '')
      .map((k) => `${k}=${params[k]}`)
      .join('&')
    params.sign = createHash('md5').update(sorted + 'test-key').digest('hex')

    const formBody = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&')

    const callbackRes = await request.post('/api/shop/payment/yipay', {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      data: formBody,
    })
    const callbackData = (await callbackRes.json()) as { success: boolean; message?: string }
    expect(callbackData.success).toBe(true)
    expect(callbackData.message).toBe('success')

    // 验证订单已发卡
    const orderDetailRes = await request.get(`/api/shop/orders/${orderNo}`)
    const orderDetail = (await orderDetailRes.json()) as {
      success: boolean
      order?: { status: string }
      codes?: Array<{ code: string }>
    }
    expect(orderDetail.success).toBe(true)
    expect(orderDetail.order?.status).toBe('fulfilled')
    expect(orderDetail.codes?.length).toBe(1)
    expect(orderDetail.codes?.[0]?.code).toMatch(/^[A-F0-9]{16}$/)
  })

  test('2. 易支付非法签名回调被拒绝', async ({ request }) => {
    expect(orderNo).not.toBe('')

    const params = {
      out_trade_no: orderNo,
      trade_no: 'YIPAY-E2E-FAKE',
      trade_status: 'TRADE_SUCCESS',
      sign: 'invalid-signature',
    }
    const formBody = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&')

    const callbackRes = await request.post('/api/shop/payment/yipay', {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      data: formBody,
    })
    expect(callbackRes.status()).toBe(400)
    const callbackData = (await callbackRes.json()) as { success: boolean; message?: string }
    expect(callbackData.success).toBe(false)
  })

  test('3. 微信占位渠道：启用被拒绝，伪造回调也被拒绝', async ({ request }) => {
    // 微信回调验签（v2 签名 / v3 AES-GCM）尚未实现，后台启用必须被拒绝
    const configRes = await request.post('/api/admin/shop/payment-configs', {
      headers: { cookie: adminCookie },
      data: {
        provider: 'wechat',
        configJson: JSON.stringify({ appId: 'test-app', mchId: 'test-mch', apiKey: 'test-key' }),
        isEnabled: true,
      },
    })
    expect(configRes.status()).toBe(400)
    const configData = (await configRes.json()) as { success: boolean; message?: string }
    expect(configData.success).toBe(false)

    // 未启用状态下，伪造「支付成功」XML 回调不得触发发卡
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<xml>
  <return_code><![CDATA[SUCCESS]]></return_code>
  <result_code><![CDATA[SUCCESS]]></result_code>
  <out_trade_no><![CDATA[SO-FAKE-WECHAT-001]]></out_trade_no>
  <transaction_id><![CDATA[WX-E2E-FAKE]]></transaction_id>
  <total_fee>1000</total_fee>
</xml>`

    const callbackRes = await request.post('/api/shop/payment/wechat', {
      headers: { 'content-type': 'text/xml' },
      data: xml,
    })
    expect(callbackRes.status()).toBe(400)
    const callbackData = (await callbackRes.json()) as { success: boolean; message?: string }
    expect(callbackData.success).toBe(false)
  })

  test('4. 支付宝占位渠道：启用被拒绝，伪造回调也被拒绝', async ({ request }) => {
    // 支付宝 RSA2 验签尚未实现，后台启用必须被拒绝（此前仅检查 app_id/trade_status 非空）
    const configRes = await request.post('/api/admin/shop/payment-configs', {
      headers: { cookie: adminCookie },
      data: {
        provider: 'alipay',
        configJson: JSON.stringify({ appId: 'test-app' }),
        isEnabled: true,
      },
    })
    expect(configRes.status()).toBe(400)
    const configData = (await configRes.json()) as { success: boolean; message?: string }
    expect(configData.success).toBe(false)

    // 未启用状态下，不带签名的伪造 form 回调不得触发发卡
    const formBody = 'out_trade_no=SO-FAKE-ALIPAY-001&trade_no=ALI-E2E-FAKE&trade_status=TRADE_SUCCESS&app_id=test-app'

    const callbackRes = await request.post('/api/shop/payment/alipay', {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      data: formBody,
    })
    expect(callbackRes.status()).toBe(400)
    const callbackData = (await callbackRes.json()) as { success: boolean; message?: string }
    expect(callbackData.success).toBe(false)
  })
})