/**
 * 弹出方向自适应分支覆盖：
 * - LanguageSwitcher：贴近视口底部向上弹（dropUp=true）/ 正常位置向下弹
 * - ThemeSwitcher：右上角场景水平右对齐 + 向下弹
 */
import './helpers/dom'
import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { I18nProvider, LanguageSwitcher } from '../src/lib/i18n/i18n-provider'
import { ThemeSwitcher } from '../src/components/theme-switcher'
import { ThemeProvider } from '../src/lib/theme-provider'

test.afterEach(() => {
  cleanup()
  document.body.removeAttribute('data-scroll-locked')
  document.body.style.removeProperty('pointer-events')
  restoreRect()
})

const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect
type RectPatch = { top: number; bottom: number; left: number; right: number } | null
let rectPatch: RectPatch = null

function restoreRect() {
  rectPatch = null
  Element.prototype.getBoundingClientRect = originalGetBoundingClientRect
}

function patchRect(patch: Exclude<RectPatch, null>) {
  rectPatch = patch
  Element.prototype.getBoundingClientRect = function (this: Element) {
    if (rectPatch) {
      return {
        top: rectPatch.top,
        bottom: rectPatch.bottom,
        left: rectPatch.left,
        right: rectPatch.right,
        width: rectPatch.right - rectPatch.left,
        height: rectPatch.bottom - rectPatch.top,
        x: rectPatch.left,
        y: rectPatch.top,
        toJSON: () => ({}),
      } as DOMRect
    }
    return originalGetBoundingClientRect.call(this)
  }
}

test('LanguageSwitcher：默认（元素位置为零）向下弹出', async () => {
  render(
    React.createElement(
      I18nProvider,
      null,
      React.createElement(LanguageSwitcher),
    ),
  )
  fireEvent.click(screen.getByRole('button', { name: /English|中文|Language/i }))
  await waitFor(() => assert.ok(document.querySelector('[role="listbox"]')))
  const menu = document.querySelector('[role="listbox"]')!
  assert.equal(menu.className.includes('bottom-full'), false)
})

test('LanguageSwitcher：贴近视口底部时向上弹出（dropUp 分支）', async () => {
  render(
    React.createElement(
      I18nProvider,
      null,
      React.createElement(LanguageSwitcher),
    ),
  )
  // 模拟 trigger 位于视口底部（bottom+288 > innerHeight 且上方空间更大）
  patchRect({ top: 640, bottom: 700, left: 24, right: 120 })
  fireEvent.click(screen.getByRole('button', { name: /English|中文|Language/i }))
  await waitFor(() => {
    const menu = document.querySelector('[role="listbox"]') as HTMLElement | null
    assert.ok(menu, 'menu rendered')
    assert.equal(menu.style.position, 'fixed')
    assert.ok(menu.style.bottom, 'drop-up uses bottom coordinate')
  })
})

test('ThemeSwitcher：右上角场景右对齐且向下弹（alignRight+dropUp=false 分支）', async () => {
  render(
    React.createElement(
      ThemeProvider,
      null,
      React.createElement(ThemeSwitcher),
    ),
  )
  // 模拟 trigger 位于右上角：上方空间不足 → 向下；右侧放不下 256 面板 → 右对齐
  patchRect({ top: 20, bottom: 70, left: 1400, right: 1500 })
  fireEvent.click(screen.getByRole('button', { name: /深空科技/ }))
  await waitFor(() => {
    const menu = document.querySelector('[role="listbox"]') as HTMLElement | null
    assert.ok(menu, 'menu rendered')
    assert.equal(menu.style.position, 'fixed')
    assert.ok(menu.style.right, 'right-aligned uses right coordinate')
    assert.ok(menu.style.top, 'downward uses top coordinate')
  })
})
