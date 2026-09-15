import assert from 'node:assert/strict'
import test from 'node:test'

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ADMIN_DIR = join(import.meta.dirname, '../src/components/admin')

function listAdminFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...listAdminFiles(full))
    } else if (entry.endsWith('.tsx')) {
      out.push(full)
    }
  }
  return out
}

const adminFiles = listAdminFiles(ADMIN_DIR)
const readSource = (file: string) => readFileSync(file, 'utf-8')

test('a11y：每个任务页组件至多一个 PageHeader（即至多一个 h1）', () => {
  // 标记 a11y-ok 的文件允许互斥渲染分支各有 PageHeader（运行时每页仍只有一个）
  const offenders = adminFiles.filter((file) => {
    const source = readSource(file)
    if (source.includes('a11y-ok: exclusive-pageheaders')) return false
    return (source.match(/<PageHeader/g) ?? []).length > 1
  })
  assert.deepEqual(offenders, [])
})

test('a11y：侧栏品牌标题不再是 h1（页面唯一 h1 属于 PageHeader）', () => {
  const sidebar = readSource(join(ADMIN_DIR, 'sidebar-nav.tsx'))
  assert.doesNotMatch(sidebar, /<h1/)
})

test('a11y：详情/确认弹框组件均带 aria-labelledby', () => {
  const dialogFiles = adminFiles.filter((file) =>
    /(drawer|dialog)\.tsx$/.test(file),
  )
  assert.ok(dialogFiles.length >= 6, `应存在至少 6 个弹框组件，实际 ${dialogFiles.length}`)

  const offenders = dialogFiles.filter(
    (file) => !/aria-labelledby=/.test(readSource(file)),
  )
  assert.deepEqual(offenders, [])
})

test('a11y：icon-only 按钮必须带 aria-label', () => {
  // 取完整 <button>...</button> 元素：剔除标签后无可见文字（无 CJK/字母数字）且未提供 aria-label 即违规
  const offenders: string[] = []
  for (const file of adminFiles) {
    const source = readSource(file)
    const elementPattern = /<button\b[^>]*>[\s\S]*?<\/button>/g
    let match: RegExpExecArray | null
    while ((match = elementPattern.exec(source)) !== null) {
      const element = match[0]
      const openingTag = element.slice(0, element.indexOf('>'))
      const visibleText = element
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, '')
      if (!/[\u4e00-\u9fa5a-zA-Z0-9]/.test(visibleText) && !/aria-label/.test(openingTag)) {
        offenders.push(`${file}: ${openingTag.slice(0, 90)}`)
      }
    }
  }
  assert.deepEqual(offenders, [])
})

test('a11y：admin 组件内按钮触控尺寸 ≥40px（禁止 h-8/h-9 内联按钮）', () => {
  const offenders: string[] = []
  for (const file of adminFiles) {
    const lines = readSource(file).split('\n')
    lines.forEach((line, index) => {
      if (/inline-flex/.test(line) && /\bh-(8|9)\b/.test(line)) {
        offenders.push(`${file}:${index + 1}`)
      }
    })
  }
  assert.deepEqual(offenders, [])
})

test('a11y：根布局声明与语言脚本一致的初始 lang/dir', () => {
  const layout = readFileSync(
    join(import.meta.dirname, '../src/app/layout.tsx'),
    'utf-8',
  )
  assert.match(layout, /lang="zh-CN"/)
  assert.match(layout, /dir="ltr"/)
})

test('a11y：不存在无效的工具类（如 bg-zinc-950/30-sm）', () => {
  const offenders = adminFiles.filter((file) =>
    /bg-zinc-950\/30-sm|[\w-]+\/30-sm"/.test(readSource(file)),
  )
  assert.deepEqual(offenders, [])
})
