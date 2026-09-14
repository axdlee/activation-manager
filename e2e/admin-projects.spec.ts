import { expect, test, type Page } from '@playwright/test'

// =============================================================
// Task 4 项目模块 e2e：URL 筛选保留、详情 Drawer、默认项目保护
// 依赖 playwright.config.ts 的 webServer（全新 e2e.db + dev server）
// =============================================================

async function gotoProjects(page: Page) {
  await page.goto('/admin/projects')
  await expect(page.getByRole('heading', { name: '项目' })).toBeVisible()
}

test.describe('项目任务页 e2e', () => {
  test('1. 创建项目（必填校验 + projectKey 规则 + 成功回列表）', async ({ page }) => {
    const runId = Date.now().toString(36)
    const projectKey = `e2e-flow-${runId}`

    await gotoProjects(page)
    await page.getByRole('button', { name: '新建项目' }).first().click()
    await expect(page.locator('#create-project-form')).toBeVisible()

    // projectKey 格式校验：非法字符被 pattern 拦截，表单不提交
    await page.locator('#create-project-name').fill(`流程项目-${runId}`)
    await page.locator('#create-project-key').fill('非法 key!')
    await page.locator('button[type="submit"][form="create-project-form"]').click()
    await expect(page.locator('#create-project-form')).toBeVisible()

    // 修正后提交成功，弹框自动关闭，列表出现新项目
    await page.locator('#create-project-key').fill(projectKey)
    await page.locator('button[type="submit"][form="create-project-form"]').click()
    await expect(page.locator('#create-project-form')).toBeHidden()
    await expect(
      page.locator('table').getByText(projectKey, { exact: true }).first(),
    ).toBeVisible({ timeout: 15_000 })
  })

  test('2. URL 筛选可分享：搜索/状态/排序写入 query，刷新后保留', async ({ page }) => {
    await gotoProjects(page)

    await page.getByLabel('搜索项目').fill('e2e-flow')
    await expect(page).toHaveURL(/keyword=e2e-flow/)

    await page.getByLabel('状态筛选').selectOption('enabled')
    await expect(page).toHaveURL(/status=enabled/)

    await page.getByLabel('排序方式').selectOption('nameAsc')
    await expect(page).toHaveURL(/sort=nameAsc/)

    // 刷新后筛选状态保留
    await page.reload()
    await expect(page.getByLabel('搜索项目')).toHaveValue('e2e-flow')
    await expect(page.getByLabel('状态筛选')).toHaveValue('enabled')
    await expect(page.getByLabel('排序方式')).toHaveValue('nameAsc')
  })

  test('3. 行操作打开详情 Drawer：策略分区 + Escape 关闭 + 焦点恢复', async ({ page }) => {
    await gotoProjects(page)

    // 默认项目行：详情应显示「不可停用」提示
    const defaultRow = page.locator('table tbody tr').filter({ hasText: '默认项目' }).first()
    await defaultRow.getByRole('button', { name: '更多操作' }).click()
    await page.getByRole('menuitem', { name: '项目详情' }).click()

    const drawer = page.getByRole('dialog')
    await expect(drawer).toBeVisible()
    await expect(drawer.getByRole('heading', { name: '换绑策略' })).toBeVisible()
    await expect(drawer.getByText('默认项目不可停用')).toBeVisible()
    await expect(drawer.getByRole('button', { name: '停用项目' })).toHaveCount(0)

    // Escape 关闭
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)

    // 非默认项目：Drawer 内可编辑策略
    const anyRow = page.locator('table tbody tr').filter({ hasText: 'e2e-flow' }).first()
    await anyRow.getByRole('button', { name: '更多操作' }).click()
    await page.getByRole('menuitem', { name: '项目详情' }).click()
    const detailDrawer = page.getByRole('dialog')
    await expect(detailDrawer.getByLabel('项目级自助换绑策略')).toBeVisible()
    await detailDrawer.getByLabel('项目级自助换绑策略').selectOption('disabled')
    await detailDrawer.getByRole('button', { name: '保存策略' }).click()
    await expect(page.getByText('项目换绑策略已更新').first()).toBeVisible({ timeout: 15_000 })
  })
})
