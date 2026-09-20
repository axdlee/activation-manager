/**
 * 支付渠道任务页行为测试：渠道启停、配置保存（原函数覆盖 36.36%）。
 */
import './helpers/dom'
import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { ShopPaymentPage } from '../src/components/admin/shop-payment-page'
import type { ShopPaymentConfig } from '../src/lib/shop-admin-data'

const configs: ShopPaymentConfig[] = [
  { provider: 'webhook', configJson: '{"secret":"old"}', isEnabled: true, configComplete: true, missingKeys: [] },
  { provider: 'yipay', configJson: '{"gateway":"https://pay.x","pid":"1","key":"k"}', isEnabled: false, configComplete: true, missingKeys: [] },
]

test.afterEach(() => {
  cleanup()
  document.body.removeAttribute('data-scroll-locked')
  document.body.style.removeProperty('pointer-events')
})

function setup(notify?: (message: string, type?: 'success' | 'error') => void) {
  const calls: Array<{ method: string; url: string; body?: unknown }> = []
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    const method = init?.method ?? 'GET'
    calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined })
    if (method === 'GET') {
      return ok({ configs })
    }
    return ok({ success: true, message: '已保存' })
  }) as unknown as typeof fetch
  render(React.createElement(ShopPaymentPage, { onNotify: notify }))
  return { calls }
}

function ok(body: unknown) {
  return { ok: true, status: 200, json: async () => body }
}

test('支付页：渠道卡渲染启用/完整性与缺失字段', async () => {
  setup()
  await screen.findAllByText('Webhook 回调')
  assert.ok(screen.getAllByText('易支付').length > 0)
  // 新 Tab UI：仅激活渠道（Webhook：已启用+配置完整）徽标在 DOM，其余渠道在 Tab 圆点 title
  assert.ok(screen.getAllByText('已启用').length > 0)
  assert.ok(screen.getAllByText('配置完整').length > 0)
  assert.ok(document.querySelector('button[role="tab"] span[title*="未启用"]'))
})

test('支付页：启停渠道发出 isEnabled 配置', async () => {
  const { calls } = setup()
  await screen.findByText('易支付')
  const toggle = screen.getAllByRole('button', { name: '停用渠道' })[0]
  fireEvent.click(toggle)
  await waitFor(() => {
    assert.ok(
      calls.some(
        (c) => c.method === 'POST' && c.url.includes('payment-configs') && JSON.stringify(c.body).includes('"isEnabled":false'),
      ),
    )
  })
})

test('支付页：webhook 密钥显示切换与保存', async () => {
  const { calls } = setup()
  const secret = await screen.findByPlaceholderText('输入回调密钥（留空不校验）') as HTMLInputElement
  assert.equal(secret.type, 'password')
  fireEvent.click(screen.getByRole('button', { name: '显示' }))
  assert.equal((screen.getByPlaceholderText('输入回调密钥（留空不校验）') as HTMLInputElement).type, 'text')

  fireEvent.change(secret, { target: { value: 'new-secret' } })
  fireEvent.click(screen.getByRole('button', { name: '保存' }))
  await waitFor(() => {
    assert.ok(
      calls.some(
        (c) => c.method === 'POST' && JSON.stringify(c.body ?? {}).includes('new-secret'),
      ),
    )
  })
})

test('支付页：易支付三项字段保存', async () => {
  const { calls } = setup()
  await screen.findAllByText('Webhook 回调') // 等 loading 完成后再切 Tab
  fireEvent.click(screen.getByText('易支付', { ignore: 'script, style' }).closest('button[role="tab"]')!)

  await screen.findByLabelText('网关地址（Gateway）')
  fireEvent.change(screen.getByLabelText('网关地址（Gateway）'), { target: { value: 'https://gate.new' } })
  fireEvent.change(screen.getByLabelText('商户 ID（PID）'), { target: { value: 'pid-2' } })
  fireEvent.change(screen.getByLabelText('商户密钥（KEY）'), { target: { value: 'key-2' } })
  fireEvent.click(screen.getByRole('button', { name: '保存配置' }))
  await waitFor(() => {
    assert.ok(
      calls.some(
        (c) =>
          c.method === 'POST' &&
          JSON.stringify(c.body ?? {}).includes('gate.new') &&
          JSON.stringify(c.body ?? {}).includes('pid-2'),
      ),
    )
  })
})

test('支付页：切换支付宝 Tab 渲染公钥字段（敏感）', async () => {
  setup()
  await screen.findAllByText('Webhook 回调')
  fireEvent.click(screen.getByText('支付宝', { selector: 'button[role="tab"]' }))
  const label = (await screen.findByLabelText('支付宝公钥')) as HTMLInputElement
  assert.equal(label.type, 'password')
  assert.ok(screen.getAllByText('启用渠道').length > 0)
})

test('支付页：webhook 密钥显隐切换（password/text 分支）', async () => {
  setup()
  const secret = await screen.findByPlaceholderText('输入回调密钥（留空不校验）') as HTMLInputElement
  assert.equal(secret.type, 'password')
  fireEvent.click(screen.getByRole('button', { name: '显示' }))
  assert.equal((screen.getByPlaceholderText('输入回调密钥（留空不校验）') as HTMLInputElement).type, 'text')
  fireEvent.click(screen.getByRole('button', { name: '隐藏' }))
  assert.equal((screen.getByPlaceholderText('输入回调密钥（留空不校验）') as HTMLInputElement).type, 'password')
})
