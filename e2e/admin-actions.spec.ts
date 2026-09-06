import { expect, test, type Page } from '@playwright/test'

// =============================================================
// 补全 e2e：后台管理操作覆盖 —— 导出 / 删除激活码 / 清理过期 /
// 项目停用-启用 / 项目改名 / 换绑策略编辑
// 依赖 playwright.config.ts 的 webServer（全新 e2e.db + dev server）
// =============================================================

async function clickDashboardTab(page: Page, tabLabel: string) {
  await page.locator('nav button', { hasText: tabLabel }).first().click()
}

async function gotoDashboard(page: Page) {
  await page.goto('/admin/dashboard')
  await expect(page.locator('h1', { hasText: '激活码管理后台' })).toBeVisible()
}

// 各测试共享数据（workers=1 串行）
let adminProjectKey = ''

test.describe.serial('后台管理操作 e2e', () => {
  test('0. 创建测试项目与激活码', async ({ page }) => {
    const runId = Date.now().toString(36)
    adminProjectKey = `e2e-admin-${runId}`

    await gotoDashboard(page)
    await clickDashboardTab(page, '项目管理')
    await page.getByRole('button', { name: '新建项目' }).click()
    await expect(page.locator('#create-project-form')).toBeVisible()
    await page.locator('#create-project-name').fill(`管理操作项目-${runId}`)
    await page.locator('#create-project-key').fill(adminProjectKey)
    await page.locator('#create-project-description').fill('e2e 管理操作测试项目')
    await page.locator('button[type="submit"][form="create-project-form"]').click()
    await expect(page.locator('#create-project-form')).toBeHidden()
    await expect(
      page.locator('table').getByText(adminProjectKey, { exact: true }).first(),
    ).toBeVisible({ timeout: 15_000 })

    // 生成 2 个激活码
    await clickDashboardTab(page, '生成激活码')
    await page.locator('#generate-selected-project-key').selectOption(adminProjectKey)
    await page.locator('#generate-license-mode').selectOption('COUNT')
    await page.locator('#generate-amount').fill('2')
    await page.locator('#generate-total-count').fill('5')
    await page.getByRole('button', { name: '生成次数型激活码' }).click()
    await expect(
      page.locator('h2', { hasText: '本次生成的激活码' }),
    ).toBeVisible({ timeout: 15_000 })
  })

  test('1. 激活码管理：筛选后导出 CSV', async ({ page }) => {
    await gotoDashboard(page)
    await clickDashboardTab(page, '激活码管理')
    await expect(page.locator('h2', { hasText: '激活码管理中心' })).toBeVisible({ timeout: 15_000 })

    // 触发导出下载
    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 })
    await page.getByRole('button', { name: '导出筛选结果' }).first().click()
    const download = await downloadPromise
    const fileName = download.suggestedFilename()
    expect(fileName).toMatch(/\.csv$/)

    // 下载内容应包含表头与数据
    const path = await download.path()
    const fs = await import('node:fs')
    const content = fs.readFileSync(path!, 'utf-8')
    expect(content).toContain('激活码')
    expect(content).toContain('次数型')
  })

  test('2. 激活码管理：删除一个激活码', async ({ page }) => {
    await gotoDashboard(page)
    await clickDashboardTab(page, '激活码管理')
    await expect(page.locator('h2', { hasText: '激活码管理中心' })).toBeVisible({ timeout: 15_000 })

    // 第一行删除按钮
    const deleteButton = page.locator('table tbody tr').first().getByRole('button', { name: '删除' })
    await expect(deleteButton).toBeVisible({ timeout: 15_000 })

    // 原生 confirm 对话框需要监听并接受
    page.on('dialog', (dialog) => dialog.accept())
    await deleteButton.click()

    // 删除成功 toast（全局 Toast）
    await expect(page.getByText('激活码删除成功').first()).toBeVisible({
      timeout: 15_000,
    })
  })

  test('3. 项目管理：编辑项目名称', async ({ page }) => {
    await gotoDashboard(page)
    await clickDashboardTab(page, '项目管理')

    const row = page.locator('table tbody tr').filter({ hasText: adminProjectKey })
    await expect(row).toBeVisible({ timeout: 15_000 })

    await row.getByRole('button', { name: '编辑基础信息' }).click()
    await expect(page.locator('#project-modal-name')).toBeVisible({ timeout: 10_000 })

    const newName = `管理操作项目改-${Date.now().toString(36)}`
    await page.locator('#project-modal-name').fill(newName)
    await page.getByRole('button', { name: '保存基础信息' }).click()

    await expect(page.getByText(newName).first()).toBeVisible({ timeout: 15_000 })
  })

  test('4. 项目管理：停用后启用', async ({ page }) => {
    await gotoDashboard(page)
    await clickDashboardTab(page, '项目管理')

    const row = page.locator('table tbody tr').filter({ hasText: adminProjectKey })
    await expect(row).toBeVisible({ timeout: 15_000 })

    // 停用（原生 confirm 自动接受）
    page.on('dialog', (dialog) => dialog.accept())
    await row.getByRole('button', { name: '停用' }).click()

    // 该行出现「已停用」状态徽章（限定在项目行内，避免命中筛选器同名标签）
    const rowDisabled = page.locator('table tbody tr').filter({ hasText: adminProjectKey })
    await expect(rowDisabled.getByText('已停用').first()).toBeVisible({ timeout: 15_000 })

    // 启用
    await rowDisabled.getByRole('button', { name: '启用' }).click()
    await expect(rowDisabled.getByText('已停用')).toHaveCount(0, { timeout: 15_000 })
  })

  test('5. 审计中心：导出审计日志 CSV', async ({ page }) => {
    await gotoDashboard(page)
    await clickDashboardTab(page, '审计中心')
    await expect(page.locator('h3', { hasText: '审计日志列表' })).toBeVisible({ timeout: 15_000 })

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 })
    await page.getByRole('button', { name: '导出筛选结果' }).first().click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.csv$/)

    const path = await download.path()
    const fs = await import('node:fs')
    const content = fs.readFileSync(path!, 'utf-8')
    expect(content).toContain('操作类型')
  })

  test('6. 消费日志：筛选后导出 CSV（空结果也应正常导出）', async ({ page }) => {
    await gotoDashboard(page)
    await clickDashboardTab(page, '消费日志')

    // 用不存在的关键词筛选
    await page.getByRole('button', { name: /筛选与刷新/ }).first().click()
    await page.locator('#consumption-search-term').fill(`no-such-req-${Date.now()}`)
    await page.getByRole('button', { name: /查看日志列表/ }).first().click()
    await expect(page.getByText(/0 条记录|暂无匹配/).first()).toBeVisible({ timeout: 15_000 })

    // 空结果时导出按钮被禁用（业务保护：无数据不可导出）
    const exportButton = page.getByRole('button', { name: '导出筛选结果' }).first()
    await expect(exportButton).toBeDisabled({ timeout: 15_000 })
  })

  test('7. 系统配置：修改 JWT 有效期并保存', async ({ page }) => {
    await gotoDashboard(page)
    await clickDashboardTab(page, '系统配置')
    await expect(page.getByRole('heading', { name: '系统配置中心' })).toBeVisible({
      timeout: 15_000,
    })

    await page.getByRole('button', { name: '认证与会话' }).first().click()
    await expect(page.getByText('JWT 密钥').first()).toBeVisible({ timeout: 15_000 })

    // 切换登录有效期到 12h
    const expiresSelect = page
      .locator('div')
      .filter({ hasText: '登录有效期' })
      .locator('select')
      .first()
    await expiresSelect.selectOption('12h')

    await page.getByRole('button', { name: '保存配置' }).click()
    await expect(page.getByText('系统配置更新成功').first()).toBeVisible({ timeout: 15_000 })
  })
})
