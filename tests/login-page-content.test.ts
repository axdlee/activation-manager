import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const loginPageSource = fs.readFileSync(
  path.join(process.cwd(), 'src/app/admin/login/page.tsx'),
  'utf8',
)

test('登录页保留 API 文档入口与首页入口', () => {
  assert.equal(loginPageSource.includes('href="/docs/api"'), true)
  assert.equal(loginPageSource.includes('href="/"'), true)
  assert.equal(loginPageSource.includes('查看 API 文档'), true)
  assert.equal(loginPageSource.includes('返回首页'), true)
})

test('登录页输入框声明 autocomplete，减少浏览器告警并提升体验', () => {
  assert.equal(loginPageSource.includes('autoComplete="username"'), true)
  assert.equal(loginPageSource.includes('autoComplete="current-password"'), true)
})
