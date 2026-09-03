import { test as setup, expect } from '@playwright/test'

const adminAuthFile = 'e2e/.auth/admin.json'

setup('管理员登录并保存会话', async ({ page }) => {
  await page.goto('/admin/login')
  await page.locator('#username').fill('admin')
  await page.locator('#password').fill('123456')
  await page.getByRole('button', { name: '登录后台' }).click()
  await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 30_000 })
  await expect(page.locator('h1', { hasText: '激活码管理后台' })).toBeVisible()

  await page.context().storageState({ path: adminAuthFile })
})