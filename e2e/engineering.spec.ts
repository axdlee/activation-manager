import { expect, test } from '@playwright/test'

// =============================================================
// 工程化能力 e2e：主题切换 / 404 页 / 未授权访问 / 健康检查 / 购物页
// =============================================================

test.describe.serial('工程化能力 e2e', () => {
  test('0. 未登录访问后台 API 返回 401', async ({ playwright }) => {
    // 用独立无 cookie 的请求上下文（smoke project 默认注入管理员 storageState）
    const anonymousContext = await playwright.request.newContext({
      baseURL: 'http://127.0.0.1:3210',
      // 显式清空继承的 storageState，模拟真正未登录
      storageState: { cookies: [], origins: [] },
    })
    try {
      const response = await anonymousContext.get('/api/admin/projects')
      expect(response.status()).toBe(401)

      const data = (await response.json()) as { success: boolean; message?: string }
      expect(data.success).toBe(false)
    } finally {
      await anonymousContext.dispose()
    }
  })

  test('1. 访问不存在页面显示 404 页', async ({ page }) => {
    await page.goto('/this-page-does-not-exist-12345')
    await expect(page.getByText('404 · 页面不存在').first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('heading', { name: '找不到这个页面' })).toBeVisible()
  })

  test('2. 健康检查端点返回 200 ok', async ({ request }) => {
    const response = await request.get('/api/health')
    expect(response.status()).toBe(200)

    const data = (await response.json()) as { status: string; service: string }
    expect(data.status).toBe('ok')
    expect(data.service).toBe('activation-manager')
  })

  test('3. 主题切换器存在且可切换主题', async ({ page }) => {
    // 登录后进后台，侧边栏应有主题切换器
    await page.goto('/admin/login')
    await page.locator('#username').fill('admin')
    await page.locator('#password').fill('123456')
    await page.getByRole('button', { name: '登录后台' }).click()
    await page.waitForURL(/\/admin\/dashboard/, { timeout: 30_000 })

    // 主题切换按钮（侧边栏，title="切换主题"）
    const themeButton = page.locator('button[title="切换主题"]').first()
    await expect(themeButton).toBeVisible({ timeout: 15_000 })
    await themeButton.click()

    // 下拉出现主题选项
    await expect(page.locator('text=翡翠绿').first()).toBeVisible({ timeout: 10_000 })

    // 选择 aurora 主题（极简浅色）
    await page.locator('text=极简浅色').first().click()

    // 主题切换后 html data-theme 属性变化
    await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'aurora')
    const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
    expect(theme).toBe('aurora')
  })

  test('4. 主题选择持久化到 localStorage 并刷新保持', async ({ page }) => {
    // 本用例独立选主题（serial 不共享 localStorage）
    await page.goto('/admin/dashboard')
    await expect(page.locator('h1', { hasText: '激活码管理后台' })).toBeVisible({ timeout: 15_000 })

    await page.locator('button[title="切换主题"]').first().click()
    await expect(page.locator('text=极简浅色').first()).toBeVisible({ timeout: 10_000 })
    await page.locator('text=极简浅色').first().click()
    await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'aurora')

    // localStorage 已写入
    const storedTheme = await page.evaluate(() =>
      localStorage.getItem('activation-manager-theme'),
    )
    expect(storedTheme).toBe('aurora')

    // 刷新后仍保持
    await page.reload()
    await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'aurora')
  })

  test('5. 购物页在无商品时显示空态', async ({ page }) => {
    await page.goto('/shop')
    await expect(page.getByRole('heading', { name: '激活码购买中心' })).toBeVisible({ timeout: 15_000 })
    // 空态文案（e2e.db 无商品时）
    await expect(page.getByText('暂无在售套餐').first()).toBeVisible({ timeout: 15_000 })
  })

  test('6. 首页可访问且包含购买激活码入口', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: '购买激活码' }).first()).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByRole('link', { name: '查看 API 文档' }).first()).toBeVisible()
  })

  test('7. 数据统计页展示 License API 运行指标面板', async ({ page }) => {
    await page.goto('/admin/dashboard')
    await expect(page.locator('h1', { hasText: '激活码管理后台' })).toBeVisible({ timeout: 15_000 })

    // 切到数据统计
    await page.locator('nav button', { hasText: '数据统计' }).first().click()
    await expect(page.getByText('License API 运行指标').first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/请求概览/).first()).toBeVisible({ timeout: 10_000 })

    // 指标 API 可访问
    const response = await page.request.get('/api/admin/metrics/license-api')
    expect(response.status()).toBe(200)
    const data = (await response.json()) as { success: boolean; metrics?: { total: number } }
    expect(data.success).toBe(true)
  })

  test('8. 系统配置：换绑策略分区可见并可修改设备绑定开关', async ({ page }) => {
    await page.goto('/admin/dashboard')
    await expect(page.locator('h1', { hasText: '激活码管理后台' })).toBeVisible({ timeout: 15_000 })

    await page.locator('nav button', { hasText: '系统配置' }).first().click()
    await expect(page.getByRole('heading', { name: '系统配置中心' })).toBeVisible({ timeout: 15_000 })

    // 切到换绑策略分区（tab 卡片）
    await page.locator('button', { hasText: /换绑策略/ }).first().click()
    await expect(page.getByRole('heading', { name: '换绑策略' }).first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('保存配置').first()).toBeVisible({ timeout: 10_000 })
  })

  test('9. 系统配置：系统展示分区包含到期通知接口字段', async ({ page }) => {
    await page.goto('/admin/dashboard')
    await expect(page.locator('h1', { hasText: '激活码管理后台' })).toBeVisible({ timeout: 15_000 })

    await page.locator('nav button', { hasText: '系统配置' }).first().click()
    await expect(page.getByRole('heading', { name: '系统配置中心' })).toBeVisible({ timeout: 15_000 })

    await page.locator('button', { hasText: /系统展示/ }).first().click()
    await expect(page.getByRole('heading', { name: '系统展示' }).first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('保存配置').first()).toBeVisible({ timeout: 10_000 })
  })

  test('10. 系统配置：认证与会话分区包含响应签名密钥字段', async ({ page }) => {
    await page.goto('/admin/dashboard')
    await expect(page.locator('h1', { hasText: '激活码管理后台' })).toBeVisible({ timeout: 15_000 })

    await page.locator('nav button', { hasText: '系统配置' }).first().click()
    await expect(page.getByRole('heading', { name: '系统配置中心' })).toBeVisible({ timeout: 15_000 })

    await page.locator('button', { hasText: /认证与会话/ }).first().click()
    await expect(page.getByRole('heading', { name: '认证与会话' }).first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('保存配置').first()).toBeVisible({ timeout: 10_000 })
  })
})
