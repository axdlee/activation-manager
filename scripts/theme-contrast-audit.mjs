/**
 * 主题 × 页面 颜色对比度真实审计：
 * - 14 套主题 × 代表性页面，真实 Chromium 渲染
 * - WCAG 相对亮度算法计算每个可见文本与其有效背景的对比度
 * - FAIL: <3.0（接近不可见）；WARN: <4.5（AA 正文标准）
 */
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

const BASE = 'http://127.0.0.1:3400'
const THEMES = [
  'dark-tech', 'midnight', 'graphite', 'aurora', 'emerald', 'violet', 'crimson',
  'ocean', 'amber', 'sakura', 'forest', 'sunrise', 'sepia', 'mono',
]
const PAGES = [
  ['概览', '/admin/overview'],
  ['项目', '/admin/projects'],
  ['生成激活码', '/admin/licenses/generate'],
  ['激活码管理', '/admin/licenses'],
  ['系统设置-分区', '/admin/settings?section=branding'],
  ['系统设置-概览', '/admin/settings'],
  ['API 接入', '/admin/integration'],
  ['订单管理', '/admin/shop/orders'],
  ['登录页', '/admin/login'],
]
const SHOT_DIR = '/tmp/theme-shots'
mkdirSync(SHOT_DIR, { recursive: true })

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
    return {
      r: fg.r * a + bg.r * (1 - a),
      g: fg.g * a + bg.g * (1 - a),
      b: fg.b * a + bg.b * (1 - a),
      a: 1,
    }
  }
  function lum(c) {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
  }
  function ratio(a, b) {
    const l1 = lum(a), l2 = lum(b)
    const hi = Math.max(l1, l2), lo = Math.min(l1, l2)
    return (hi + 0.05) / (lo + 0.05)
  }
  function solidBg(el) {
    // 自内向外：第一个不透明实底即为有效背景（内层不透明已完全遮盖外层）
    let cur = el
    while (cur && cur.nodeType === 1) {
      const bg = parse(getComputedStyle(cur).backgroundColor)
      if (bg && bg.a >= 0.95) return bg
      cur = cur.parentElement
    }
    return parse(getComputedStyle(document.documentElement).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 }
  }
  const page = getComputedStyle(document.documentElement)
  const pageBg = (() => {
    let c = parse(page.backgroundColor)
    if (!c || c.a < 0.95) c = parse(getComputedStyle(document.body).backgroundColor) || { r: 17, g: 24, b: 39, a: 1 }
    return c
  })()
  const issues = []
  const seen = new Set()
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    const node = walker.currentNode
    const text = (node.textContent || '').trim()
    if (!text) continue
    const el = node.parentElement
    if (!el) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none') continue
    // 禁用控件低对比是预期语义，不计入
    if (el.closest('[disabled]')) continue
    const rect = el.getBoundingClientRect()
    if (rect.width < 2 || rect.height < 2) continue
    const fg = parse(cs.color)
    if (!fg) continue
    let opacity = 1
    let o = el
    while (o) { opacity *= parseFloat(getComputedStyle(o).opacity || '1'); o = o.parentElement }
    const visibleFg = blend({ ...fg, a: fg.a * opacity }, pageBg)
    const bg = solidBg(el)
    const blendedBg = blend(bg, pageBg)
    const r = ratio(visibleFg, blendedBg)
    const fontSize = parseFloat(cs.fontSize)
    const bold = parseInt(cs.fontWeight) >= 700
    const large = fontSize >= 24 || (fontSize >= 18.66 && bold)
    const threshold = large ? 3 : 4.5
    if (r >= threshold) continue
    const key = el.tagName + '|' + (el.className || '').toString().slice(0, 80) + '|' + cs.color
    if (seen.has(key)) continue
    seen.add(key)
    let chainSel = []
    let p = el
    for (let i = 0; i < 4 && p; i++) {
      chainSel.push(p.tagName.toLowerCase() + (typeof p.className === 'string' && p.className ? '.' + p.className.split(' ').slice(0, 3).join('.') : ''))
      p = p.parentElement
    }
    issues.push({
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role') || (el.closest('button,a') ? el.closest('button,a').tagName.toLowerCase() : ''),
      cls: (typeof el.className === 'string' ? el.className : '').slice(0, 110),
      chain: chainSel.join(' < '),
      text: text.slice(0, 24),
      fg: cs.color, bg: bg ? getComputedStyle(el.closest('button,a,th,td,div') || el).backgroundColor : 'transparent',
      ratio: +r.toFixed(2),
      threshold,
      severity: r < 3 ? 'FAIL' : 'WARN',
      opacity: +opacity.toFixed(2),
    })
  }
  // 无文本的 icon-only 交互元素：检测按钮可见性（color≈bg）
  document.querySelectorAll('button, [role="button"], a').forEach((el) => {
    if (el.hasAttribute('disabled')) return
    if (el.getAttribute('aria-label') || el.innerText.trim()) return
    const cs = getComputedStyle(el)
    const svg = el.querySelector('svg')
    if (!svg) return
    const stroke = svg.getAttribute('stroke') || getComputedStyle(svg).color || cs.color
    const fg = parse(stroke === 'currentColor' ? cs.color : stroke)
    if (!fg) return
    const bg = solidBg(el)
    const r = ratio(blend(fg, pageBg), blend(bg, pageBg))
    if (r < 3) {
      issues.push({
        tag: el.tagName.toLowerCase(), role: 'icon-button',
        cls: (typeof el.className === 'string' ? el.className : '').slice(0, 110),
        chain: 'icon-button', text: '(icon)',
        fg: cs.color, bg: 'inherit', ratio: +r.toFixed(2), threshold: 3,
        severity: r < 2 ? 'FAIL' : 'WARN', opacity: 1,
      })
    }
  })
  return { theme: document.documentElement.getAttribute('data-theme'), issues }
})()
`

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' })
const page = await ctx.newPage()

// 登录一次
await page.goto(`${BASE}/admin/login`)
await page.locator('#username').fill('admin')
await page.locator('#password').fill('123456')
await page.getByRole('button', { name: '登录后台' }).click()
await page.waitForURL(/\/admin\/overview/, { timeout: 30_000 })

const report = {}
for (const theme of THEMES) {
  report[theme] = {}
  for (const [pageName, path] of PAGES) {
    const p2 = await ctx.newPage()
    await p2.addInitScript((t) => {
      try {
        window.localStorage.setItem('activation-manager-theme', t)
      } catch {}
    }, theme)
    try {
      await p2.goto(BASE + path, { waitUntil: 'networkidle', timeout: 20_000 })
    } catch {}
    await p2.waitForTimeout(500)
    if (process.env.DEBUG_DUMP && pageName === '系统设置-分区') {
      const dbg = await p2.evaluate(() => {
        const btn = document.querySelector('button.rounded-lg.border')
        const icon = btn ? btn.querySelector('div.flex.h-11') : null
        return {
          cls: icon ? icon.className.slice(0, 90) : null,
          bg: icon ? getComputedStyle(icon).backgroundColor : null,
          primary: getComputedStyle(document.documentElement).getPropertyValue('--primary'),
        }
      })
      console.error('DEBUG_DUMP:', JSON.stringify(dbg))
    }
    const applied = await p2.evaluate(() => document.documentElement.getAttribute('data-theme'))
    const result = await p2.evaluate(AUDIT_FN)
    const fails = result.issues.filter((i) => i.severity === 'FAIL')
    const warns = result.issues.filter((i) => i.severity === 'WARN')
    report[theme][pageName] = { applied: applied || theme, fail: fails.length, warn: warns.length, issues: result.issues }
    if (fails.length > 0) {
      writeFileSync(`${SHOT_DIR}/${theme}-${pageName.replace(/\//g, '_')}.json`, JSON.stringify(fails, null, 1))
    }
    if (pageName === '概览') {
      await p2.screenshot({ path: `${SHOT_DIR}/${theme}-overview.png`, fullPage: false })
    }
    await p2.close()
  }
  console.error(`done: ${theme}`)
}

// 汇总
const summary = []
for (const theme of THEMES) {
  let fail = 0, warn = 0, worst = null
  for (const [pageName, data] of Object.entries(report[theme])) {
    fail += data.fail
    warn += data.warn
    for (const issue of data.issues) {
      if (!worst || issue.ratio < worst.ratio) worst = { page: pageName, ...issue }
    }
  }
  summary.push({ theme, fail, warn, worst })
}
summary.sort((a, b) => b.fail - a.fail)
console.log('=== 每主题汇总（按 FAIL 数排序）===')
for (const s of summary) {
  console.log(
    `${s.theme.padEnd(10)} FAIL=${String(s.fail).padStart(3)} WARN=${String(s.warn).padStart(3)}  最差: ${s.worst ? `${s.worst.page} ${s.worst.chain.slice(0, 70)} "${s.worst.text}" ratio=${s.worst.ratio}` : '—'}`,
  )
}
writeFileSync('/tmp/theme-shots/report.json', JSON.stringify(report, null, 1))
await browser.close()
