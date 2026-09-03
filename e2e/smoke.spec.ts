import { expect, test, type Page } from '@playwright/test'

// =============================================================
// e2e 冒烟测试：登录(auth.setup) → 创建项目 → 发码 → 激活 → 消费 → 审计
// 依赖 playwright.config.ts 的 webServer（全新 e2e.db + dev server）
// 所有 test 共享 admin 会话（storageState: e2e/.auth/admin.json）
// =============================================================

const MACHINE_ID = 'machine-e2e-001'

// 各测试共享的运行时数据（workers=1 串行执行）
let projectKey = ''
let projectName = ''
let licenseCode = ''
let requestId1 = ''
let requestId2 = ''

async function clickDashboardTab(page: Page, tabLabel: string) {
  await page.locator('nav button', { hasText: tabLabel }).first().click()
}

async function gotoDashboard(page: Page) {
  await page.goto('/admin/dashboard')
  await expect(page.locator('h1', { hasText: '激活码管理后台' })).toBeVisible()
}

test.describe.serial('激活码系统 e2e 冒烟', () => {
  test('1. 创建项目', async ({ page }) => {
    const runId = Date.now().toString(36)
    projectKey = `e2e-${runId}`
    projectName = `E2E冒烟项目-${runId}`

    await gotoDashboard(page)
    await clickDashboardTab(page, '项目管理')
    await expect(page.getByRole('button', { name: '新建项目' })).toBeVisible()

    await page.getByRole('button', { name: '新建项目' }).click()
    await expect(page.locator('#create-project-form')).toBeVisible()

    await page.locator('#create-project-name').fill(projectName)
    await page.locator('#create-project-key').fill(projectKey)
    await page.locator('#create-project-description').fill('e2e 冒烟测试项目')
    await page.locator('button[type="submit"][form="create-project-form"]').click()

    // 弹框关闭且项目出现在列表中
    await expect(page.locator('#create-project-form')).toBeHidden()
    await expect(
      page.locator('table').getByText(projectKey, { exact: true }).first(),
    ).toBeVisible({ timeout: 15_000 })
  })

  test('2. 生成激活码（次数型）', async ({ page }) => {
    await gotoDashboard(page)
    await clickDashboardTab(page, '生成激活码')
    await expect(page.locator('#generate-selected-project-key')).toBeVisible()

    await page.locator('#generate-selected-project-key').selectOption(projectKey)
    await page.locator('#generate-license-mode').selectOption('COUNT')
    await page.locator('#generate-amount').fill('1')
    await page.locator('#generate-total-count').fill('3')

    await page.getByRole('button', { name: '生成次数型激活码' }).click()

    // 等待「本次生成的激活码」表格出现并抓取 code
    await expect(
      page.locator('h2', { hasText: '本次生成的激活码' }),
    ).toBeVisible({ timeout: 15_000 })
    const codeCell = page.locator('td.font-mono').first()
    await expect(codeCell).toBeVisible()
    licenseCode = (await codeCell.textContent())?.trim() ?? ''
    expect(licenseCode).toMatch(/^[A-Z0-9-]+$/)
  })

  test('3. 公开 API：激活 → 状态 → 消费（含幂等重放）', async ({ request }) => {
    expect(projectKey).not.toBe('')
    expect(licenseCode).not.toBe('')
    requestId1 = `req-e2e-${Date.now()}-a`
    requestId2 = `req-e2e-${Date.now()}-b`

    // 3.1 激活
    const activate = await request.post('/api/license/activate', {
      data: { projectKey, code: licenseCode, machineId: MACHINE_ID },
    })
    expect(activate.status()).toBe(200)
    const activateBody = (await activate.json()) as {
      success: boolean
      remainingCount?: number
      isActivated?: boolean
    }
    expect(activateBody.success).toBe(true)
    expect(activateBody.remainingCount).toBe(3)

    // 3.2 状态
    const status = await request.post('/api/license/status', {
      data: { projectKey, code: licenseCode, machineId: MACHINE_ID },
    })
    expect(status.status()).toBe(200)
    const statusBody = (await status.json()) as {
      success: boolean
      isActivated?: boolean
      remainingCount?: number
    }
    expect(statusBody.success).toBe(true)
    expect(statusBody.isActivated).toBe(true)
    expect(statusBody.remainingCount).toBe(3)

    // 3.3 消费一次（真实扣次）
    const consume1 = await request.post('/api/license/consume', {
      data: { projectKey, code: licenseCode, machineId: MACHINE_ID, requestId: requestId1 },
    })
    const consume1Body = (await consume1.json()) as {
      success: boolean
      remainingCount?: number
      idempotent?: boolean
      valid?: boolean
    }
    expect(consume1Body.success).toBe(true)
    expect(consume1Body.remainingCount).toBe(2)
    expect(consume1Body.idempotent).toBe(false)
    expect(consume1Body.valid).toBe(true)

    // 3.4 幂等重放：不重复扣次
    const consumeReplay = await request.post('/api/license/consume', {
      data: { projectKey, code: licenseCode, machineId: MACHINE_ID, requestId: requestId1 },
    })
    const replayBody = (await consumeReplay.json()) as {
      success: boolean
      remainingCount?: number
      idempotent?: boolean
    }
    expect(replayBody.success).toBe(true)
    expect(replayBody.remainingCount).toBe(2)
    expect(replayBody.idempotent).toBe(true)

    // 3.5 第二次真实扣次
    const consume2 = await request.post('/api/license/consume', {
      data: { projectKey, code: licenseCode, machineId: MACHINE_ID, requestId: requestId2 },
    })
    const consume2Body = (await consume2.json()) as {
      success: boolean
      remainingCount?: number
      valid?: boolean
    }
    expect(consume2Body.success).toBe(true)
    expect(consume2Body.remainingCount).toBe(1)
    expect(consume2Body.valid).toBe(true)
  })

  test('4. 后台消费日志：应含 2 条真实扣次记录', async ({ page }) => {
    expect(requestId1).not.toBe('')
    expect(requestId2).not.toBe('')

    // API 侧（storageState 自动携带 admin 会话 cookie）
    const response = await page.request.get(
      `/api/admin/consumptions?projectKey=${projectKey}&page=1&pageSize=20`,
    )
    expect(response.status()).toBe(200)
    const body = (await response.json()) as {
      success: boolean
      logs: Array<{ requestId: string }>
    }
    expect(body.success).toBe(true)
    const requestIds = body.logs.map((log) => log.requestId)
    expect(requestIds).toContain(requestId1)
    expect(requestIds).toContain(requestId2)
    expect(requestIds.filter((id) => id === requestId1).length).toBe(1)

    // UI 侧：消费日志工作区，切到筛选 tab 搜索 requestId2
    await gotoDashboard(page)
    await clickDashboardTab(page, '消费日志')
    await page.getByRole('button', { name: /筛选与刷新/ }).first().click()
    await page.locator('#consumption-search-term').fill(requestId2)
    await page.getByRole('button', { name: /查看日志列表/ }).first().click()
    await expect(
      page.locator('table').getByText(requestId2, { exact: true }).first(),
    ).toBeVisible({ timeout: 15_000 })
  })

  test('5. 审计中心：应记录创建项目与批量发码', async ({ page }) => {
    await gotoDashboard(page)
    await clickDashboardTab(page, '审计中心')
    await expect(
      page.locator('h3', { hasText: '审计日志列表' }),
    ).toBeVisible({ timeout: 15_000 })

    // 审计日志是服务端分页，默认最新在前；刚发生的操作应出现在第一页
    await expect(
      page.locator('table').getByText('创建项目', { exact: true }).first(),
    ).toBeVisible({ timeout: 15_000 })
    await expect(
      page.locator('table').getByText('批量生成激活码', { exact: true }).first(),
    ).toBeVisible({ timeout: 15_000 })
  })

  test('6. 审计筛选自动刷新（回归：筛选变更后列表自动更新）', async ({ page }) => {
    await gotoDashboard(page)
    await clickDashboardTab(page, '审计中心')
    await expect(
      page.locator('h3', { hasText: '审计日志列表' }),
    ).toBeVisible({ timeout: 15_000 })

    // 切到「筛选与导出」，输入一个不可能命中的关键词
    await page.getByRole('button', { name: /筛选与导出/ }).first().click()
    await page.locator('#audit-log-search-term').fill(`no-such-keyword-${Date.now()}`)

    // 切回日志列表：自动刷新 effect 应以新筛选条件重新拉取，得到空结果
    await page.getByRole('button', { name: /日志列表/ }).first().click()
    await expect(
      page.getByText('暂无匹配的管理员审计日志').first(),
    ).toBeVisible({ timeout: 15_000 })

    // 重置筛选：应恢复完整日志列表
    await page.getByRole('button', { name: /筛选与导出/ }).first().click()
    await page.getByRole('button', { name: '重置筛选' }).click()
    await page.getByRole('button', { name: /日志列表/ }).first().click()
    await expect(
      page.locator('table').getByText('创建项目', { exact: true }).first(),
    ).toBeVisible({ timeout: 15_000 })
  })
})
