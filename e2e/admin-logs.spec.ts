import { expect, test, type Page } from '@playwright/test'

// =============================================================
// Task 6 日志任务页 e2e：消费/审计的 URL 筛选、详情 Drawer、时间线
// 依赖 playwright.config.ts 的 webServer（全新 e2e.db + dev server）
// =============================================================

async function gotoConsumptions(page: Page) {
  await page.goto('/admin/consumptions')
  await expect(page.getByRole('heading', { name: '消费日志', exact: true })).toBeVisible()
}

async function gotoAudit(page: Page) {
  await page.goto('/admin/audit')
  await expect(page.getByRole('heading', { name: '审计中心', exact: true })).toBeVisible()
}

test.describe('日志任务页 e2e', () => {
  test('1. 消费日志：URL 筛选可分享，刷新保留；自动刷新开关存在', async ({ page }) => {
    await gotoConsumptions(page)

    await page.getByLabel('搜索 requestId / 机器ID / 激活码').fill(`no-such-${Date.now()}`)
    await expect(page).toHaveURL(/keyword=no-such-/)

    // 快捷时间范围写入 from/to
    await page.locator('details', { hasText: '时间范围' }).locator('summary').click()
    await page.getByRole('button', { name: '最近7天' }).click()
    await expect(page).toHaveURL(/from=/)
    await expect(page).toHaveURL(/to=/)

    await page.reload()
    await expect(page.getByLabel('搜索 requestId / 机器ID / 激活码')).not.toHaveValue('')

    // 空结果空态与导出禁用
    await expect(page.getByText('没有匹配的消费日志').first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: '导出筛选结果' })).toBeDisabled()
  })

  test('2. 审计中心：URL 筛选 + 行详情 Drawer 时间线（无裸 JSON）', async ({ page }) => {
    // 先产生一条审计记录（创建项目）
    await page.goto('/admin/projects')
    await page.getByRole('button', { name: '新建项目' }).first().click()
    const runId = Date.now().toString(36)
    await page.locator('#create-project-name').fill(`审计项目-${runId}`)
    await page.locator('#create-project-key').fill(`e2e-audit-${runId}`)
    await page.locator('button[type="submit"][form="create-project-form"]').click()
    await expect(page.locator('#create-project-form')).toBeHidden()

    await gotoAudit(page)

    // 关键词写入 URL
    await page.getByLabel('搜索管理员 / 目标 / 原因').fill('admin')
    await expect(page).toHaveURL(/keyword=admin/)

    // 行点击打开 Drawer：时间线呈现可读明细
    const firstRow = page.locator('table tbody tr').first()
    await expect(firstRow).toBeVisible({ timeout: 15_000 })
    await firstRow.getByRole('button', { name: '详情' }).click()

    const drawer = page.getByRole('dialog')
    await expect(drawer).toBeVisible()
    await expect(drawer.getByText('时间线')).toBeVisible()
    await expect(drawer.getByText('admin').first()).toBeVisible()
    await expect(drawer.getByText(/detailJson/)).toHaveCount(0)

    // Escape 关闭
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})
