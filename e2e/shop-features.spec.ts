import { expect, test } from '@playwright/test'

// =============================================================
// 购买中心新功能 e2e：总开关 / 预定义码池 / 排序 / 售罄
// =============================================================

test.describe.serial('购买中心新功能 e2e', () => {
  let adminCookie = ''
  let predefProductId = 0
  let dynamicProductId = 0

  test('0. 登录并创建动态 + 预定义商品', async ({ request }) => {
    const loginRes = await request.post('/api/admin/login', {
      data: { username: 'admin', password: '123456' },
    })
    expect(loginRes.status()).toBe(200)
    adminCookie = (loginRes.headers()['set-cookie'] || '').split(';')[0] || ''

    // 动态商品（价格 800）
    const dynRes = await request.post('/api/admin/shop/products', {
      headers: { cookie: adminCookie },
      data: {
        name: '动态周卡',
        projectId: 1,
        licenseMode: 'TIME',
        cardType: '周卡',
        validDays: 7,
        priceInCents: 800,
        stockMode: 'DYNAMIC',
      },
    })
    const dynData = (await dynRes.json()) as { success: boolean; product?: { id: number; stockMode: string } }
    expect(dynData.success).toBe(true)
    dynamicProductId = dynData.product?.id ?? 0
    expect(dynData.product?.stockMode).toBe('DYNAMIC')

    // 预定义商品（价格 2000）
    const preRes = await request.post('/api/admin/shop/products', {
      headers: { cookie: adminCookie },
      data: {
        name: '预存月卡',
        projectId: 1,
        licenseMode: 'TIME',
        cardType: '月卡',
        validDays: 30,
        priceInCents: 2000,
        stockMode: 'PREDEFINED',
      },
    })
    const preData = (await preRes.json()) as { success: boolean; product?: { id: number; stockMode: string } }
    expect(preData.success).toBe(true)
    predefProductId = preData.product?.id ?? 0
    expect(preData.product?.stockMode).toBe('PREDEFINED')
  })

  test('1. 预定义商品补货 2 张并在公开列表显示库存', async ({ request }) => {
    expect(predefProductId).toBeGreaterThan(0)

    const restockRes = await request.post('/api/admin/shop/products/restock', {
      headers: { cookie: adminCookie },
      data: { productId: predefProductId, amount: 2 },
    })
    const restockData = (await restockRes.json()) as { success: boolean; stocked?: number }
    expect(restockData.success).toBe(true)
    expect(restockData.stocked).toBe(2)

    // 公开列表显示库存
    const listRes = await request.get('/api/shop/products')
    const listData = (await listRes.json()) as {
      products?: Array<{ id: number; stockMode: string; availableStock: number | null }>
    }
    const predef = listData.products?.find((p) => p.id === predefProductId)
    expect(predef?.stockMode).toBe('PREDEFINED')
    expect(predef?.availableStock).toBe(2)
  })

  test('2. 商品排序：priceAsc 与 priceDesc 顺序正确', async ({ request }) => {
    const ascRes = await request.get('/api/shop/products?sort=priceAsc')
    const ascData = (await ascRes.json()) as { products?: Array<{ priceInCents: number }> }
    const prices = (ascData.products ?? []).map((p) => p.priceInCents)
    const sorted = [...prices].sort((a, b) => a - b)
    expect(prices).toEqual(sorted)

    const descRes = await request.get('/api/shop/products?sort=priceDesc')
    const descData = (await descRes.json()) as { products?: Array<{ priceInCents: number }> }
    const descPrices = (descData.products ?? []).map((p) => p.priceInCents)
    const descSorted = [...descPrices].sort((a, b) => b - a)
    expect(descPrices).toEqual(descSorted)
  })

  test('3. 预定义商品售罄后下单被拒 409，补货后恢复', async ({ request }) => {
    expect(predefProductId).toBeGreaterThan(0)

    // 先卖光 2 张：下单×2 + 后台确认发卡
    for (let i = 0; i < 2; i++) {
      const orderRes = await request.post('/api/shop/orders', {
        data: {
          productId: predefProductId,
          providerId: 'manual',
          contactEmail: `stock${i}@test.com`,
        },
      })
      expect(orderRes.status()).toBe(200)
      const orderData = (await orderRes.json()) as { order?: { orderNo: string } }
      const confirmRes = await request.post(`/api/admin/shop/orders/${orderData.order?.orderNo}/confirm`, {
        headers: { cookie: adminCookie },
        data: {},
      })
      expect(confirmRes.status()).toBe(200)
    }

    // 第 3 单应 409 售罄
    const rejectedRes = await request.post('/api/shop/orders', {
      data: {
        productId: predefProductId,
        providerId: 'manual',
        contactEmail: 'soldout3@test.com',
      },
    })
    expect(rejectedRes.status()).toBe(409)
    const rejectedData = (await rejectedRes.json()) as { message?: string }
    expect(rejectedData.message).toContain('售罄')

    // 补货后恢复
    const restockRes = await request.post('/api/admin/shop/products/restock', {
      headers: { cookie: adminCookie },
      data: { productId: predefProductId, amount: 1 },
    })
    expect(restockRes.status()).toBe(200)

    const okRes = await request.post('/api/shop/orders', {
      data: {
        productId: predefProductId,
        providerId: 'manual',
        contactEmail: 'back@test.com',
      },
    })
    expect(okRes.status()).toBe(200)
  })

  test('4. 购买中心总开关：关闭后 API 403，开启后恢复', async ({ request }) => {
    // 关闭
    const offRes = await request.post('/api/admin/system-config', {
      headers: { cookie: adminCookie },
      data: { configs: [{ key: 'shopEnabled', value: false }] },
    })
    expect(offRes.status()).toBe(200)

    // 商品列表/渠道 403
    expect((await request.get('/api/shop/products')).status()).toBe(403)
    expect((await request.get('/api/shop/payment/channels')).status()).toBe(403)

    // 开启
    const onRes = await request.post('/api/admin/system-config', {
      headers: { cookie: adminCookie },
      data: { configs: [{ key: 'shopEnabled', value: true }] },
    })
    expect(onRes.status()).toBe(200)

    expect((await request.get('/api/shop/products')).status()).toBe(200)
  })
})
