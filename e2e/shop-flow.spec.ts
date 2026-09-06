import { expect, test, type Page } from '@playwright/test'

// =============================================================
// 支付自动发卡 e2e：购买页下单 → 后台确认 → 发卡 → 查询 → 找回 → 激活
// 依赖 playwright.config.ts 的 webServer（全新 e2e.db + dev server）
// =============================================================

async function clickDashboardTab(page: Page, tabLabel: string) {
  await page.locator('nav button', { hasText: tabLabel }).first().click()
}

async function loginAsAdmin(page: Page) {
  await page.goto('/admin/login')
  await page.locator('#username').fill('admin')
  await page.locator('#password').fill('123456')
  await page.getByRole('button', { name: '登录后台' }).click()
  await page.waitForURL(/\/admin\/dashboard/, { timeout: 30_000 })
  await expect(page.locator('h1', { hasText: '激活码管理后台' })).toBeVisible()
}

let createdOrderNo = ''
let generatedCode = ''

test.describe.serial('支付自动发卡 e2e', () => {
  test('0. 后台创建卡密商品', async ({ page }) => {
    await loginAsAdmin(page)
    await clickDashboardTab(page, '购买中心')
    await expect(page.getByText('商品管理').first()).toBeVisible({ timeout: 15_000 })

    await page.getByText('商品管理').first().click()
    await expect(page.getByText('新建商品').first()).toBeVisible({ timeout: 10_000 })

    // 填充商品表单
    const nameInput = page.getByPlaceholder('商品名称（如 月卡）')
    await nameInput.fill('e2e月卡')
    await page.getByPlaceholder('商品描述（可选）').fill('e2e 测试商品')
    // 显式选择 default 项目（商品绑定 default，激活时用 default）
    await page.locator('select').first().selectOption('1')
    await page.getByPlaceholder('价格（元）').fill('9.9')

    await page.getByRole('button', { name: '创建商品' }).click()
    await expect(page.getByText('商品创建成功').first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('e2e月卡').first()).toBeVisible({ timeout: 15_000 })
  })

  test('1. 公开购买页下单并显示支付信息', async ({ page }) => {
    await page.goto('/shop')
    await expect(page.getByRole('heading', { name: '激活码购买中心' })).toBeVisible()

    // 选择商品
    await page.getByText('e2e月卡').first().click()

    // 填写联系方式
    await page.locator('#contact-email').fill('e2e-buyer@example.com')
    await page.locator('#contact-phone').fill('13900000000')

    // 下单
    await page.getByRole('button', { name: '立即下单' }).click()

    // 订单生成 + 支付信息展示
    await expect(page.getByText('订单已生成').first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('等待支付').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/请向收款账户支付/).first()).toBeVisible({ timeout: 10_000 })

    // 提取订单号（font-mono span 内）
    const orderNoText = await page.locator('span.font-mono').first().innerText()
    createdOrderNo = orderNoText.trim()
    expect(createdOrderNo).toMatch(/^SO[A-Z0-9]+$/)
  })

  test('2. 后台确认收款后自动发卡', async ({ page }) => {
    expect(createdOrderNo).not.toBe('')

    await loginAsAdmin(page)
    await clickDashboardTab(page, '购买中心')
    await page.getByText('订单管理').first().click()

    const orderRow = page.locator('tbody tr').filter({ hasText: createdOrderNo })
    await expect(orderRow).toBeVisible({ timeout: 15_000 })

    // 原生 confirm 自动接受
    page.on('dialog', (dialog) => dialog.accept())
    await orderRow.getByRole('button', { name: '确认收款发卡' }).click()

    // 确认后状态变为已发卡
    await expect(orderRow.getByText('已发卡').first()).toBeVisible({ timeout: 15_000 })
  })

  test('3. 订单查询返回已发卡密', async ({ page }) => {
    expect(createdOrderNo).not.toBe('')

    const response = await page.request.get(`/api/shop/orders/${createdOrderNo}`)
    expect(response.status()).toBe(200)
    const data = (await response.json()) as {
      success: boolean
      order?: { status: string }
      codes?: Array<{ id: number; code: string }>
    }

    expect(data.success).toBe(true)
    expect(data.order?.status).toBe('fulfilled')
    expect(data.codes && data.codes.length).toBe(1)
    generatedCode = data.codes?.[0]?.code ?? ''
    expect(generatedCode).toMatch(/^[A-F0-9]{16}$/)
  })

  test('4. 卡密找回：正确联系方式返回卡密，错误联系方式拒绝', async ({ page }) => {
    expect(createdOrderNo).not.toBe('')
    expect(generatedCode).not.toBe('')

    // 正确联系方式
    const okResponse = await page.request.post('/api/shop/orders/query', {
      data: { orderNo: createdOrderNo, contactEmail: 'e2e-buyer@example.com' },
    })
    expect(okResponse.status()).toBe(200)
    const okData = (await okResponse.json()) as { success: boolean; codes?: Array<{ code: string }> }
    expect(okData.success).toBe(true)
    expect(okData.codes?.[0]?.code).toBe(generatedCode)

    // 错误联系方式
    const badResponse = await page.request.post('/api/shop/orders/query', {
      data: { orderNo: createdOrderNo, contactEmail: 'wrong@example.com' },
    })
    expect(badResponse.status()).toBe(403)
  })

  test('5. 找回页 UI 可操作（凭联系方式找回卡密）', async ({ page }) => {
    await page.goto('/shop')
    await expect(page.getByRole('heading', { name: '找回卡密' })).toBeVisible()

    // 用订单号 + 联系方式在页面找回
    await page.getByPlaceholder('订单号，如 SO…').fill(createdOrderNo)
    await page.getByPlaceholder('下单时的邮箱 / 手机号 / 微信号').fill('e2e-buyer@example.com')
    await page.getByRole('button', { name: '找回卡密' }).click()

    await expect(page.getByText(generatedCode).first()).toBeVisible({ timeout: 15_000 })
  })

  test('6. 发出的卡密可真实激活', async ({ page }) => {
    expect(generatedCode).not.toBe('')

    const response = await page.request.post('/api/license/activate', {
      data: { projectKey: 'default', code: generatedCode, machineId: 'e2e-shop-buyer' },
    })
    expect(response.status()).toBe(200)
    const data = (await response.json()) as { success: boolean; isActivated?: boolean }
    expect(data.success).toBe(true)
    expect(data.isActivated).toBe(true)
  })
})
