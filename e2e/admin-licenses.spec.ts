import { expect, test, type Page } from '@playwright/test'

// =============================================================
// Task 5 激活码任务页 e2e：生成三段式表单 / URL 筛选 / 详情 Drawer / 清理确认
// 依赖 playwright.config.ts 的 webServer（全新 e2e.db + dev server）
// =============================================================

async function gotoLicenses(page: Page) {
  await page.goto('/admin/licenses')
  await expect(page.getByRole('heading', { name: '激活码', exact: true })).toBeVisible({
    timeout: 15_000,
  })
}

test.describe('激活码任务页 e2e', () => {
  test('1. 生成页：高级策略默认折叠，COUNT 模式隐藏时间字段', async ({ page }) => {
    await page.goto('/admin/licenses/generate')
    await expect(page.getByRole('heading', { name: '生成激活码' })).toBeVisible()

    // 默认 TIME：时间字段可见，COUNT 字段不可见
    await expect(page.locator('#generate-card-type')).toBeVisible()
    await expect(page.locator('#generate-total-count')).toHaveCount(0)

    // 切换 COUNT
    await page.locator('#generate-license-mode').selectOption('COUNT')
    await expect(page.locator('#generate-total-count')).toBeVisible()
    await expect(page.locator('#generate-card-type')).toHaveCount(0)

    // 高级换绑策略默认折叠，展开后可见
    const details = page.locator('details', { hasText: '高级换绑策略' })
    await expect(details).toBeVisible()
    await expect(details.locator('#generate-rebind-policy')).toBeHidden()
    await details.locator('summary').click()
    await expect(details.locator('#generate-rebind-policy')).toBeVisible()
  })

  test('2. URL 筛选可分享：状态/项目/套餐写入 query，刷新保留', async ({ page }) => {
    await gotoLicenses(page)

    await page.getByLabel('状态筛选').selectOption('unused')
    await expect(page).toHaveURL(/status=unused/)

    await page.getByLabel('套餐类型筛选').selectOption('none')
    await expect(page).toHaveURL(/cardType=none/)

    await page.reload()
    await expect(page.getByLabel('状态筛选')).toHaveValue('unused')
    await expect(page.getByLabel('套餐类型筛选')).toHaveValue('none')
  })

  test('3. 清理过期绑定走 ConfirmDialog 二次确认', async ({ page }) => {
    await gotoLicenses(page)

    await page.getByRole('button', { name: '清理过期绑定' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText(/清理所有过期激活码/)).toBeVisible()

    // 取消不执行
    await dialog.getByRole('button', { name: '取消', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})
