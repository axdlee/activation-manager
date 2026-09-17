import { chromium } from '@playwright/test'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' })
const page = await ctx.newPage()
await page.goto('http://127.0.0.1:3400/admin/login', { waitUntil: 'networkidle' })
// 打开右上角主题切换器
await page.locator('.relative >> button[aria-haspopup="listbox"]').last().click()
await page.waitForTimeout(400)
await page.screenshot({ path: '/tmp/theme-shots/login-theme-picker.png' })
// 统计可选主题项数量 + 面板是否在视口内
const info = await page.evaluate(() => {
  const listbox = document.querySelector('[role="listbox"]')
  if (!listbox) return { found: false }
  const rect = listbox.getBoundingClientRect()
  const items = listbox.querySelectorAll('[role="option"], button').length
  return { found: true, items, top: Math.round(rect.top), bottom: Math.round(rect.bottom), inViewport: rect.top >= 0 && rect.bottom <= window.innerHeight }
})
console.log('PICKER:', JSON.stringify(info))
await browser.close()
