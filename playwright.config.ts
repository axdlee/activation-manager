import { existsSync } from 'node:fs'
import { defineConfig } from '@playwright/test'

// 若浏览器安装到临时目录（沙箱环境），用该路径
if (process.env.PLAYWRIGHT_BROWSERS_PATH === undefined) {
  const pwDir = '/tmp/pw-browsers'
  if (existsSync(pwDir)) process.env.PLAYWRIGHT_BROWSERS_PATH = pwDir
}

const PORT = 3210
const BASE_URL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'smoke',
      testMatch: /(smoke|workspaces|admin-actions|shop-flow)\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        storageState: 'e2e/.auth/admin.json',
      },
    },
  ],
  webServer: {
    // 每次运行使用全新 e2e 独立数据库；predev 的 bootstrap:dev 会自动建表并初始化默认管理员
    command: `rm -f prisma/e2e.db prisma/e2e.db-journal && DATABASE_URL=file:./e2e.db PORT=${PORT} npm run dev`,
    url: `${BASE_URL}/admin/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
