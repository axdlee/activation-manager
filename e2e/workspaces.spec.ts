import { expect, test, type Browser, type Page } from '@playwright/test'

// =============================================================
// 补全 e2e：未登录守卫 / 首页入口 / 公开 API 文档 / 统计页 /
// 时间卡发码+激活 / 系统配置保存 / 修改密码错误路径 / 登出
// 依赖 playwright.config.ts 的 webServer（全新 e2e.db + dev server）
// =============================================================

const MACHINE_ID = 'machine-e2e-workspace-001'

// 各测试共享的运行时数据（workers=1 串行执行）
let timeProjectKey = ''
let timeLicenseCode = ''

async function clickDashboardTab(page: Page, tabLabel: string) {
  await page.locator('nav button', { hasText: tabLabel }).first().click()
}

async function gotoDashboard(page: Page) {
  await page.goto('/admin/dashboard')
  await expect(page.locator('h1', { hasText: '激活码管理后台' })).toBeVisible()
}

test.describe.serial('补全工作区与页面 e2e', () => {
  test('0. 未登录访问 /admin/dashboard 会被重定向到登录页', async ({ browser }: { browser: Browser }) => {
    // 独立 context：显式清空 storageState（否则会继承项目 use 配置）
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await context.newPage()
    await page.goto('/admin/dashboard', { waitUntil: 'load' })
    await page.waitForURL(/\/admin\/login/, { timeout: 15_000 })
    await expect(page.locator('#username')).toBeVisible()
    await context.close()
  })

  test('1. 首页快速入口：进入管理后台与查看 API 文档', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: '激活码管理系统' })).toBeVisible()

    await page.getByRole('link', { name: '进入管理后台' }).first().click()
    await page.waitForURL(/\/admin\/login/, { timeout: 15_000 })
    await expect(page.locator('#username')).toBeVisible()

    await page.goto('/')
    await page.getByRole('link', { name: '查看 API 文档' }).first().click()
    await page.waitForURL(/\/docs\/api/, { timeout: 15_000 })
    await expect(page.getByText('面向插件与客户端的 API 文档中心')).toBeVisible()
  })

  test('2. 公开 API 文档页渲染概览、接口、示例与联调四个分区', async ({ page }) => {
    await page.goto('/docs/api')
    await expect(page.getByText('面向插件与客户端的 API 文档中心')).toBeVisible()

    for (const tab of ['接入概览', '正式接口', '多语言示例', '联调后台']) {
      await page.getByRole('button', { name: tab }).first().click()
    }
    await page.getByRole('button', { name: '正式接口' }).first().click()
    await expect(page.getByText('activate', { exact: false }).first()).toBeVisible({ timeout: 10_000 })
  })

  test('3. 数据统计页渲染统计卡片与运营洞察', async ({ page }) => {
    await gotoDashboard(page)
    await expect(page.getByRole('heading', { name: '数据统计' })).toBeVisible()
    for (const label of ['总激活码数', '已使用', '可用激活码']) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible()
    }
    await expect(page.getByText('使用率统计').first()).toBeVisible()
    await expect(page.getByText('运营洞察').first()).toBeVisible()
  })

  test('4. 时间卡（TIME 型）发码并在公开 API 激活', async ({ page, request }) => {
    const runId = Date.now().toString(36)
    timeProjectKey = `e2e-time-${runId}`

    await gotoDashboard(page)
    await clickDashboardTab(page, '项目管理')
    await page.getByRole('button', { name: '新建项目' }).click()
    await expect(page.locator('#create-project-form')).toBeVisible()
    await page.locator('#create-project-name').fill(`时间卡项目-${runId}`)
    await page.locator('#create-project-key').fill(timeProjectKey)
    await page.locator('#create-project-description').fill('e2e 时间卡测试项目')
    await page.locator('button[type="submit"][form="create-project-form"]').click()
    await expect(page.locator('#create-project-form')).toBeHidden()
    await expect(
      page.locator('table').getByText(timeProjectKey, { exact: true }).first(),
    ).toBeVisible({ timeout: 15_000 })

    // 生成时间卡
    await clickDashboardTab(page, '生成激活码')
    await page.locator('#generate-selected-project-key').selectOption(timeProjectKey)
    await page.locator('#generate-license-mode').selectOption('TIME')
    await expect(page.locator('#generate-card-type')).toBeVisible()
    await page.locator('#generate-card-type').selectOption({ index: 6 }) // 自定义
    await expect(page.locator('#generate-expiry-days')).toBeEnabled()
    await page.locator('#generate-expiry-days').fill('30')
    await page.locator('#generate-amount').fill('1')
    await page.getByRole('button', { name: '生成时间型激活码' }).click()

    await expect(
      page.locator('h2', { hasText: '本次生成的激活码' }),
    ).toBeVisible({ timeout: 15_000 })
    const codeCell = page.locator('td.font-mono').first()
    await expect(codeCell).toBeVisible()
    timeLicenseCode = (await codeCell.textContent())?.trim() ?? ''
    expect(timeLicenseCode).toMatch(/^[A-Z0-9-]+$/)

    // 公开 API 激活时间卡
    const activate = await request.post('/api/license/activate', {
      data: { projectKey: timeProjectKey, code: timeLicenseCode, machineId: MACHINE_ID },
    })
    expect(activate.status()).toBe(200)
    const activateBody = (await activate.json()) as {
      success: boolean
      isActivated?: boolean
      expiresAt?: string
    }
    expect(activateBody.success).toBe(true)
    expect(activateBody.isActivated).toBe(true)

    const status = await request.post('/api/license/status', {
      data: { projectKey: timeProjectKey, code: timeLicenseCode, machineId: MACHINE_ID },
    })
    expect(status.status()).toBe(200)
    const statusBody = (await status.json()) as { success: boolean; isActivated?: boolean }
    expect(statusBody.success).toBe(true)
    expect(statusBody.isActivated).toBe(true)
  })

  test('5. 系统配置：修改系统名称并保存成功', async ({ page }) => {
    await gotoDashboard(page)
    await clickDashboardTab(page, '系统配置')
    await expect(page.getByRole('heading', { name: '系统配置中心' })).toBeVisible({ timeout: 15_000 })

    // 切到「品牌与展示」分区（含 systemName 字段）
    await page.getByRole('button', { name: '系统展示' }).first().click()
    const nameInput = page.getByPlaceholder('例如：浏览器插件授权中心')
    await expect(nameInput).toBeVisible({ timeout: 15_000 })

    const newName = `E2E配置系统-${Date.now().toString(36)}`
    await nameInput.fill(newName)
    await page.getByRole('button', { name: '保存配置' }).click()

    // 保存成功 toast
    await expect(page.getByText('系统配置更新成功').first()).toBeVisible({ timeout: 15_000 })

    // 重新进入分区确认已持久化
    await page.getByRole('button', { name: '配置总览' }).first().click()
    await page.getByRole('button', { name: '系统展示' }).first().click()
    await expect(page.getByPlaceholder('例如：浏览器插件授权中心')).toHaveValue(newName, {
      timeout: 15_000,
    })
  })

  test('6. 修改密码：错误当前密码给出明确提示（不真正改密）', async ({ page }) => {
    await gotoDashboard(page)
    await clickDashboardTab(page, '修改密码')
    await expect(page.getByRole('heading', { name: '管理员密码工作台' })).toBeVisible()

    await page.locator('#currentPassword').fill('wrong-password')
    await page.locator('#newPassword').fill('NewPass123!')
    await page.locator('#confirmPassword').fill('NewPass123!')
    await page.getByRole('button', { name: '修改密码', exact: true }).click()

    await expect(page.getByText('当前密码不正确').first()).toBeVisible({ timeout: 15_000 })
  })

  test('7. API 接入工作区（后台模式）渲染四个分区', async ({ page }) => {
    await gotoDashboard(page)
    await clickDashboardTab(page, 'API 接入')
    // 工作区 tab 导航容器（侧边栏按钮描述也含「正式接口」，需限定在 mt-6 grid 容器内）
    const workspaceTabs = page.locator('div.mt-6.grid')
    await expect(workspaceTabs.getByRole('button', { name: '接入概览' }).first()).toBeVisible({
      timeout: 15_000,
    })

    await workspaceTabs.getByRole('button', { name: '正式接口' }).first().click()
    await expect(page.getByText('activate', { exact: false }).first()).toBeVisible({ timeout: 10_000 })

    await workspaceTabs.getByRole('button', { name: '多语言示例' }).first().click()
    await expect(page.getByText('多语言示例').first()).toBeVisible()

    await workspaceTabs.getByRole('button', { name: '联调后台' }).first().click()
    await expect(page.getByText('联调后台').first()).toBeVisible()
  })

  test('8. 登出：点击登出回到登录页，且后台受保护', async ({ page, browser }) => {
    await gotoDashboard(page)
    await page.getByRole('button', { name: '登出' }).click()
    await page.waitForURL(/\/admin\/login/, { timeout: 15_000 })
    await expect(page.locator('#username')).toBeVisible()

    // 登出后的会话不应再能访问后台
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const freshPage = await context.newPage()
    await freshPage.goto('/admin/dashboard', { waitUntil: 'load' })
    await freshPage.waitForURL(/\/admin\/login/, { timeout: 15_000 })
    await context.close()
  })
})
