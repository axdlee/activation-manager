import { expect, test } from '@playwright/test'

// =============================================================
// Task 10 响应式/可访问性验收矩阵：
// - 桌面 1440×900 / 1280×720，移动 390×844
// - 12 个任务路由：无横向页面溢出、可见 h1 恰好一个
// - RTL（ar-SA）：dir=rtl 生效且不横向溢出
// =============================================================

const ROUTES = [
  '/admin/overview',
  '/admin/projects',
  '/admin/licenses',
  '/admin/licenses/generate',
  '/admin/consumptions',
  '/admin/audit',
  '/admin/integration',
  '/admin/shop/products',
  '/admin/shop/orders',
  '/admin/shop/payment',
  '/admin/settings',
  '/admin/settings/security',
]

const VIEWPORTS = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'laptop-1280', width: 1280, height: 720 },
  { name: 'mobile-390', width: 390, height: 844 },
]

for (const viewport of VIEWPORTS) {
  test.describe(`响应式矩阵 @${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    for (const route of ROUTES) {
      test(`${route} 无横向溢出且单 h1`, async ({ page }) => {
        await page.goto(route)
        await expect(page.locator('main')).toBeVisible({ timeout: 15_000 })

        const metrics = await page.evaluate(() => ({
          scrollWidth: document.body.scrollWidth,
          innerWidth: window.innerWidth,
        }))
        // 表格在容器内横向滚动，页面本身不得溢出（根滚动器已 overflow-x: clip）
        expect(
          metrics.scrollWidth,
          `${route} @${viewport.name} 页面横向溢出`,
        ).toBeLessThanOrEqual(metrics.innerWidth + 1)

        await expect(page.locator('h1:visible')).toHaveCount(1)
      })
    }
  })
}

test.describe('RTL 验收（ar-SA）', () => {
  test.use({
    viewport: { width: 1280, height: 720 },
  })

  test('dir=rtl 生效且概览/接入页无横向溢出', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('activation-manager-locale', 'ar-SA')
    })

    for (const route of ['/admin/overview', '/admin/integration']) {
      await page.goto(route)
      await expect(page.locator('main')).toBeVisible({ timeout: 15_000 })

      const dir = await page.evaluate(() => document.documentElement.dir)
      expect(dir).toBe('rtl')

      const metrics = await page.evaluate(() => ({
        scrollWidth: document.body.scrollWidth,
        innerWidth: window.innerWidth,
      }))
      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth + 1)
    }
  })
})
