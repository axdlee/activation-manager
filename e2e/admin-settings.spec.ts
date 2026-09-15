import { expect, test, type Page } from '@playwright/test'

// =============================================================
// Task 8 设置与账户安全 e2e：概览 + 分区导航 + 未保存保存栏 + 改密错误提示
// 依赖 playwright.config.ts 的 webServer（全新 e2e.db + dev server）
// =============================================================

async function gotoSettings(page: Page) {
  await page.goto('/admin/settings')
  await expect(page.getByRole('heading', { name: '系统设置', exact: true })).toBeVisible({
    timeout: 15_000,
  })
}

test.describe('设置与账户安全 e2e', () => {
  test('1. 设置概览：摘要卡 + 分区链接卡 + 账户安全入口', async ({ page }) => {
    await gotoSettings(page)

    // 摘要卡
    await expect(page.getByText('配置项').first()).toBeVisible()

    // 分区链接卡进入分区后 URL 可寻址
    await page.getByRole('link', { name: /系统展示/ }).first().click()
    await expect(page).toHaveURL(/section=branding/)
    await expect(
      page.locator('header').getByRole('heading', { name: '系统展示' }),
    ).toBeVisible()

    // 分区内 tabs 导航可切回其他分区
    await page.getByRole('link', { name: /认证与会话/ }).first().click()
    await expect(page).toHaveURL(/section=security/)

    // 账户安全入口
    await page.goto('/admin/settings')
    await page.getByRole('link', { name: /账户安全/ }).last().click()
    await expect(page).toHaveURL(/\/admin\/settings\/security/)
  })

  test('2. 改密：错误当前密码给出明确提示（不真正改密）', async ({ page }) => {
    await page.goto('/admin/settings/security')
    await expect(page.getByRole('heading', { name: '管理员密码工作台' })).toBeVisible({
      timeout: 15_000,
    })
    // 等 React hydration 完成再填值，避免受控输入被重置
    await page.waitForLoadState('networkidle')

    await page.locator('#currentPassword').fill('wrong-password')
    await page.locator('#newPassword').fill('NewPass123!')
    await page.locator('#confirmPassword').fill('NewPass123!')
    await page.locator('form').getByRole('button', { name: '修改密码' }).click()

    await expect(page.getByText('当前密码不正确').first()).toBeVisible({ timeout: 15_000 })
  })
})
