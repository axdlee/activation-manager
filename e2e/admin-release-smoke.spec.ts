import { expect, test, type Page } from '@playwright/test'

// =============================================================
// Task 11 发布前冒烟：12 个新路由可加载（单 h1），
// 旧 /admin/dashboard?tab=... 全部跳转到映射路由。
// =============================================================

const ROUTE_H1: Array<[string, string]> = [
  ['/admin/overview', '概览'],
  ['/admin/projects', '项目'],
  ['/admin/licenses', '激活码'],
  ['/admin/licenses/generate', '生成激活码'],
  ['/admin/consumptions', '消费日志'],
  ['/admin/audit', '审计中心'],
  ['/admin/integration', 'API 接入'],
  ['/admin/shop/products', '商品'],
  ['/admin/shop/orders', '订单'],
  ['/admin/shop/payment', '支付渠道'],
  ['/admin/settings', '系统设置'],
  ['/admin/settings/security', '管理员密码工作台'],
]

const LEGACY_REDIRECTS: Array<[string, RegExp]> = [
  ['?tab=stats', /\/admin\/overview/],
  ['?tab=projects', /\/admin\/projects/],
  ['?tab=generate', /\/admin\/licenses\/generate/],
  ['?tab=list', /\/admin\/licenses/],
  ['?tab=consumptions', /\/admin\/consumptions/],
  ['?tab=auditLogs', /\/admin\/audit/],
  ['?tab=apiDocs', /\/admin\/integration/],
  ['?tab=shop', /\/admin\/shop\/products/],
  ['?tab=systemConfig', /\/admin\/settings/],
  ['?tab=changePassword', /\/admin\/settings\/security/],
]

async function assertRouteLoads(page: Page, route: string, h1: string) {
  await page.goto(route)
  await expect(
    page.getByRole('heading', { name: h1, exact: true }).first(),
  ).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('h1:visible')).toHaveCount(1)
}

test.describe('发布冒烟：任务型路由与旧入口兼容', () => {
  for (const [route, h1] of ROUTE_H1) {
    test(`路由加载 ${route}`, async ({ page }) => {
      await assertRouteLoads(page, route, h1)
    })
  }

  for (const [query, expectedUrl] of LEGACY_REDIRECTS) {
    test(`旧入口兼容 /admin/dashboard${query}`, async ({ page }) => {
      await page.goto(`/admin/dashboard${query}`)
      await expect(page).toHaveURL(expectedUrl, { timeout: 15_000 })
      await expect(page.locator('main')).toBeVisible()
    })
  }

  test('旧 dashboard 无 tab 访问跳转概览', async ({ page }) => {
    await page.goto('/admin/dashboard')
    await expect(page).toHaveURL(/\/admin\/overview/, { timeout: 15_000 })
  })
})
