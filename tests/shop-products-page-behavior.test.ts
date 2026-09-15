/**
 * 商品管理任务页行为测试：创建/编辑 Dialog、更多菜单、删除与补货确认（原函数覆盖 22%）。
 */
import './helpers/dom'
import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { ShopProductsPage } from '../src/components/admin/shop-products-page'
import type { ShopProduct } from '../src/lib/shop-admin-data'

const products: ShopProduct[] = [
  {
    id: 1,
    name: '月卡',
    description: '30 天',
    projectKey: 'default',
    licenseMode: 'TIME',
    cardType: '月卡',
    validDays: 30,
    totalCount: null,
    priceInCents: 990,
    isEnabled: true,
    sortOrder: 0,
    stockMode: 'PREDEFINED',
  },
]

test.afterEach(() => {
  cleanup()
  // Radix 关闭动画可能残留 body 锁定属性，影响后续用例的交互
  document.body.removeAttribute('data-scroll-locked')
  document.body.style.removeProperty('pointer-events')
})

function setup() {
  const notifications: Array<{ message: string; type?: 'success' | 'error' }> = []
  const calls: Array<{ method: string; url: string; body?: unknown }> = []
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    const method = init?.method ?? 'GET'
    calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined })
    if (method !== 'GET' && url.includes('/api/admin/shop/products')) {
      return ok({ success: true, message: 'ok' })
    }
    if (url.includes('/api/admin/shop/products')) return ok({ products })
    if (url.includes('/api/admin/projects')) return ok({ projects: [{ id: 1, projectKey: 'default', name: '默认项目' }] })
    return ok({ success: true, message: 'ok' })
  }) as unknown as typeof fetch

  render(
    React.createElement(ShopProductsPage, {
      onNotify: (message: string, type?: 'success' | 'error') => {
        notifications.push({ message, type })
      },
    }),
  )
  return { notifications, calls }
}

function ok(body: unknown) {
  return { ok: true, status: 200, json: async () => body }
}

/** 等列表数据加载完成（行与更多菜单出现） */
async function waitForRow() {
  await screen.findByText('月卡')
  return screen.getByRole('button', { name: '更多操作' })
}

function openMoreMenu(moreButton: HTMLElement) {
  fireEvent.pointerDown(moreButton)
  fireEvent.click(moreButton)
}

test('商品页：创建弹框校验必填并提交正确 payload', async () => {
  const { notifications } = setup()

  // 空表单直接提交 → 必填校验错误提示
  fireEvent.click(screen.getByRole('button', { name: '新建商品' }))
  const dialog = await screen.findByRole('dialog')
  assert.ok(dialog)
  fireEvent.click(screen.getByRole('button', { name: '创建商品' }))
  await waitFor(() => {
    assert.ok(notifications.some((n) => n.type === 'error'))
  })

  // 填齐后提交：payload 字段逐项核对
  fireEvent.change(screen.getByPlaceholderText('商品名称（如 月卡）'), { target: { value: '年卡' } })
  fireEvent.change(screen.getByPlaceholderText('商品描述（可选）'), { target: { value: '描述' } })
  fireEvent.change(screen.getByLabelText('所属项目'), { target: { value: '1' } })
  fireEvent.change(screen.getByLabelText('价格（元）'), { target: { value: '12' } })
  fireEvent.click(screen.getByRole('button', { name: '创建商品' }))

  await waitFor(() => {
    assert.ok(notifications.some((n) => n.message === '商品创建成功'))
  })
})

test('商品页：更多菜单编辑商品并保存', async () => {
  const { calls } = setup()
  openMoreMenu(await waitForRow())
  fireEvent.click(await screen.findByText('编辑商品'))

  const dialog = await screen.findByRole('dialog')
  assert.match(dialog.textContent!, /编辑商品/)
  const nameInput = await screen.findByLabelText('商品名称') as HTMLInputElement
  assert.equal(nameInput.value, '月卡')
  fireEvent.change(nameInput, { target: { value: '月卡改' } })
  fireEvent.click(screen.getByRole('button', { name: '保存商品' }))

  await waitFor(() => {
    assert.ok(calls.some((c) => c.method === 'PATCH' && JSON.stringify(c.body).includes('月卡改')))
  })
  await waitFor(() => {
    assert.ok(screen.queryByRole('dialog') === null)
  })
})

test('商品页：删除走确认弹框且发出 DELETE', async () => {
  const { calls } = setup()
  openMoreMenu(await waitForRow())
  fireEvent.click(await screen.findByText('删除'))

  assert.ok(await screen.findByText('删除商品'))
  fireEvent.click(screen.getByRole('button', { name: '确认删除' }))

  await waitFor(() => {
    assert.ok(calls.some((c) => c.method === 'DELETE' && c.url.includes('/api/admin/shop/products/1')))
  })
})

test('商品页：预定义码补货确认弹框带数量校验', async () => {
  const { calls, notifications } = setup()
  openMoreMenu(await waitForRow())
  fireEvent.click(await screen.findByText('补货', { exact: true }))

  const amount = await screen.findByLabelText('补货数量（1-100）') as HTMLInputElement
  fireEvent.change(amount, { target: { value: '500' } })
  fireEvent.click(screen.getByRole('button', { name: '确认补货' }))
  await waitFor(() => {
    assert.ok(notifications.some((n) => n.type === 'error'))
  })

  fireEvent.change(screen.getByLabelText('补货数量（1-100）'), { target: { value: '20' } })
  fireEvent.click(screen.getByRole('button', { name: '确认补货' }))
  await waitFor(() => {
    assert.ok(calls.some((c) => c.url.includes('/restock') && JSON.stringify(c.body).includes('"amount":20')))
  })
})
