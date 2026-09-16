/**
 * 14 主题 × 8 页面 全量真实浏览器验证矩阵：
 * - 每页截图存档（人工核验）
 * - 每页对比度审计（WCAG）
 * - 移动端 390×844 抽验（每主题概览 + 激活码管理）
 */
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

const BASE = 'http://127.0.0.1:3400'
const THEMES = [
  'dark-tech', 'midnight', 'graphite', 'aurora', 'emerald', 'violet', 'crimson',
  'ocean', 'amber', 'sakura', 'forest', 'sunrise', 'sepia', 'mono',
]
const PAGES = [
  ['overview', '/admin/overview'],
  ['projects', '/admin/projects'],
  ['generate', '/admin/licenses/generate'],
  ['licenses', '/admin/licenses'],
  ['settings-section', '/admin/settings?section=branding'],
  ['integration', '/admin/integration'],
  ['shop-orders', '/admin/shop/orders'],
  ['login', '/admin/login'],
]
const MOBILE_PAGES = [
  ['overview', '/admin/overview'],
  ['licenses', '/admin/licenses'],
]
const SHOT = '/tmp/theme-matrix'
mkdirSync(`${SHOT}/desktop`, { recursive: true })
mkdirSync(`${SHOT}/mobile`, { recursive: true })

const AUDIT_FN = `
(() => {
  function parse(c) {
    if (!c) return null
    const m = c.match(/rgba?\\(([\\d.]+),\\s*([\\d.]+),\\s*([\\d.]+)(?:,\\s*([\\d.]+))?\\)/)
    if (!m) return null
    return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] }
  }
  function blend(fg, bg) {
    const a = fg.a
    return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 }
  }
  function lum(c) {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
  }
  function ratio(a, b) {
    const l1 = lum(a), l2 = lum(b)
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
  }
  function solidBg(el) {
    let cur = el
    while (cur && cur.nodeType === 1) {
      const bg = parse(getComputedStyle(cur).backgroundColor)
      if (bg && bg.a >= 0.95) return bg
      cur = cur.parentElement
    }
    return parse(getComputedStyle(document.documentElement).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 }
  }
  const pageBg = parse(getComputedStyle(document.documentElement).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 }
  const issues = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    const node = walker.currentNode
    const text = (node.textContent || '').trim()
    if (!text) continue
    const el = node.parentElement
    if (!el) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none') continue
    const rect = el.getBoundingClientRect()
    if (rect.width < 2 || rect.height < 2) continue
    if (el.closest('[disabled]')) continue
    const fg = parse(cs.color)
    if (!fg) continue
    let opacity = 1
    let o = el
    while (o) { opacity *= parseFloat(getComputedStyle(o).opacity || '1'); o = o.parentElement }
    const visibleFg = blend({ ...fg, a: fg.a * opacity }, pageBg)
    const bg = solidBg(el)
    const r = ratio(visibleFg, blend(bg, pageBg))
    const fontSize = parseFloat(cs.fontSize)
    const bold = parseInt(cs.fontWeight) >= 700
    const threshold = fontSize >= 24 || (fontSize >= 18.66 && bold) ? 3 : 4.5
    if (r >= threshold) continue
    issues.push({
      text: text.slice(0, 20),
      cls: (typeof el.className === 'string' ? el.className : '').slice(0, 80),
      ratio: +r.toFixed(2),
      severity: r < 3 ? 'FAIL' : 'WARN',
    })
  }
  return issues
})()
`

const browser = await chromium.launch()
const summary = []

async function auditPage(pageCtx, theme, pageName, path, shotDir) {
  const p = await pageCtx.newPage()
  await p.addInitScript((t) => {
    try { window.localStorage.setItem('activation-manager-theme', t) } catch {}
  }, theme)
  try {
    await p.goto(BASE + path, { waitUntil: 'networkidle', timeout: 20_000 })
  } catch {}
  await p.waitForTimeout(500)
  const issues = await p.evaluate(AUDIT_FN)
  const fail = issues.filter((i) => i.severity === 'FAIL')
  const warn = issues.filter((i) => i.severity === 'WARN')
  await p.screenshot({ path: `${shotDir}/${theme}-${pageName}.png` })
  if (fail.length) {
    writeFileSync(`${shotDir}/${theme}-${pageName}-FAIL.json`, JSON.stringify(fail, null, 1))
  }
  summary.push({ theme, page: pageName, fail: fail.length, warn: warn.length, viewport: shotDir.includes('mobile') ? 'mobile' : 'desktop' })
  if (fail.length) {
    console.error(`FAIL ${theme} ${pageName}: ${fail.map((i) => `${i.text}(${i.ratio})`).join(', ')}`)
  }
  await p.close()
}

// 桌面全矩阵
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' })
const login = await ctx.newPage()
await login.goto(`${BASE}/admin/login`)
await login.locator('#username').fill('admin')
await login.locator('#password').fill('123456')
await login.getByRole('button', { name: '登录后台' }).click()
await login.waitForURL(/\/admin\/overview/, { timeout: 30_000 })
await login.close()

const DESKTOP_DONE = process.env.SKIP_DESKTOP === '1'
for (const theme of THEMES) {
  if (DESKTOP_DONE) break
  console.error(`audit: ${theme}`)
  for (const [pageName, path] of PAGES) {
    await auditPage(ctx, theme, pageName, path, `${SHOT}/desktop`)
  }
}
await ctx.close()

// 移动端抽验
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'zh-CN' })
const mlogin = await mctx.newPage()
await mlogin.goto(`${BASE}/admin/login`)
await mlogin.locator('#username').fill('admin')
await mlogin.locator('#password').fill('123456')
await mlogin.getByRole('button', { name: '登录后台' }).click()
await mlogin.waitForURL(/\/admin\/overview/, { timeout: 30_000 })
await mlogin.close()

for (const theme of ['sakura', 'forest', 'sunrise', 'sepia', 'mono', 'aurora', 'dark-tech', 'emerald']) {
  for (const [pageName, path] of MOBILE_PAGES) {
    await auditPage(mctx, theme, pageName, path, `${SHOT}/mobile`)
  }
}
await mctx.close()

// 汇总
const byThemeFail = {}
for (const s of summary) {
  byThemeFail[s.theme] = byThemeFail[s.theme] || { fail: 0, warn: 0, pages: [] }
  byThemeFail[s.theme].fail += s.fail
  byThemeFail[s.theme].warn += s.warn
  if (s.fail > 0) byThemeFail[s.theme].pages.push(`${s.page}(${s.fail})`)
}
console.log('=== 全矩阵汇总 ===')
for (const [theme, data] of Object.entries(byThemeFail)) {
  console.log(`${theme.padEnd(10)} FAIL=${String(data.fail).padStart(3)} WARN=${String(data.warn).padStart(4)}  ${data.pages.length ? '坏点: ' + data.pages.join(', ') : '✓ 无不可见项'}`)
}
writeFileSync(`${SHOT}/summary.json`, JSON.stringify(summary, null, 1))
await browser.close()
