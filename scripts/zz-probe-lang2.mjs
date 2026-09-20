import { chromium } from '@playwright/test'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 379, height: 976 }, locale: 'zh-CN' })
const page = await ctx.newPage()
await page.goto('http://127.0.0.1:3400/admin/login')
await page.locator('#username').fill('admin')
await page.locator('#password').fill('123456')
await page.getByRole('button', { name: '登录后台' }).click()
await page.waitForURL(/overview/, { timeout: 30000 })
await page.waitForTimeout(800)
await page.getByRole('button', { name: 'menu' }).click()
await page.waitForTimeout(500)
const langBtn = page.locator('[role="dialog"], body').getByText('中文').first()
await langBtn.evaluate((el) => el.focus())
await page.keyboard.press('Enter')
await page.waitForTimeout(400)
const r = await page.evaluate(() => {
  const menu = document.querySelector('[role="listbox"]')
  if (!menu) return { found: false }
  const cs = getComputedStyle(menu)
  const rect = menu.getBoundingClientRect()
  return {
    position: cs.position,
    rect: { t: Math.round(rect.top), b: Math.round(rect.bottom), l: Math.round(rect.left), r: Math.round(rect.right) },
    vh: window.innerHeight,
    vw: window.innerWidth,
    inViewport: rect.top >= 0 && rect.bottom <= window.innerHeight && rect.left >= 0 && rect.right <= window.innerWidth,
    items: menu.querySelectorAll('li').length,
  }
})
console.log(JSON.stringify(r, null, 1))
await page.screenshot({ path: '/tmp/lang-narrow-fixed.png' })
await browser.close()
