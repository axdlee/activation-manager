import { test as setup, expect } from '@playwright/test'

const adminAuthFile = 'e2e/.auth/admin.json'

setup('管理员登录并保存会话', async ({ page }) => {
  await page.goto('/admin/login')
  await page.locator('#username').fill('admin')
  await page.locator('#password').fill('123456')
  await page.getByRole('button', { name: '登录后台' }).click()
  await expect(page).toHaveURL(/\/admin\/(overview|dashboard)/, { timeout: 30_000 })
  // 品牌标题已降级为非 h1（页面唯一 h1 属于 PageHeader，Task 10 验收要求）
  await expect(page.getByRole('heading', { name: '概览', exact: true })).toBeVisible()

  await page.context().storageState({ path: adminAuthFile })
})