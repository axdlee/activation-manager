import { expect, test, type Page } from '@playwright/test'

// =============================================================
// Task 9 API 接入页 e2e：章节导航（URL 可寻址）、代码复制、后台联调 CTA
// 依赖 playwright.config.ts 的 webServer（全新 e2e.db + dev server）
// =============================================================

async function gotoIntegration(page: Page) {
  await page.goto('/admin/integration')
  await expect(page.getByRole('heading', { name: 'API 接入', exact: true })).toBeVisible({
    timeout: 15_000,
  })
}

test.describe('API 接入任务页 e2e', () => {
  test('1. 章节导航写入 URL，刷新保留；内容随章节切换', async ({ page }) => {
    await gotoIntegration(page)

    // 桌面目录（保持 mt-6 grid 容器契约）
    const sidebar = page.locator('div.mt-6.grid')
    await expect(sidebar.getByRole('button', { name: '接入概览' }).first()).toBeVisible()

    await sidebar.getByRole('button', { name: '正式接口' }).first().click()
    await expect(page).toHaveURL(/section=endpoints/)
    await expect(page.getByText('activate', { exact: false }).first()).toBeVisible({
      timeout: 10_000,
    })

    // 刷新后章节保留
    await page.reload()
    await expect(page).toHaveURL(/section=endpoints/)
    await expect(page.getByText('activate', { exact: false }).first()).toBeVisible()
  })

  test('2. 后台联调 CTA 直达联调章节', async ({ page }) => {
    await gotoIntegration(page)

    await page.getByRole('button', { name: '后台联调' }).first().click()
    await expect(page).toHaveURL(/section=admin/)
    await expect(page.getByText('后台联调').first()).toBeVisible()
  })

  test('3. 代码示例块可展开并带复制按钮', async ({ page }) => {
    await gotoIntegration(page)

    await page.getByRole('button', { name: '多语言示例' }).first().click()
    const blocks = page.locator('details[data-code-block]')
    const first = blocks.first()
    await expect(first).toBeVisible({ timeout: 10_000 })

    // 首个示例默认展开
    await expect(first.locator('pre')).toBeVisible()
    await expect(first.getByRole('button', { name: /复制/ })).toBeVisible()

    // 第二个块默认折叠，点击 summary 后展开
    const second = blocks.nth(1)
    await second.locator('summary').click()
    await expect(second.locator('pre')).toBeVisible()
  })
})
