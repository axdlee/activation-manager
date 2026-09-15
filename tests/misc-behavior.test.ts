/**
 * 订单页操作 + 小工具模块补测（原函数覆盖：shop-orders 56%、class-names 33%、page-types 47%）。
 */
import './helpers/dom'
import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { ShopOrdersPage } from '../src/components/admin/shop-orders-page'
import {
  getPaginationPages,
  getSpecLabel,
  getExpiryLabel,
  getLicenseModeLabel,
  getProjectDisplayName,
} from '../src/lib/license-codes-export'
import { cardTypes } from '../src/lib/dashboard-page-types'

test.afterEach(() => {
  cleanup()
  document.body.removeAttribute('data-scroll-locked')
  document.body.style.removeProperty('pointer-events')
})

function ok(body: unknown) {
  return { ok: true, status: 200, json: async () => body }
}

const orders = [
  {
    id: 1,
    orderNo: 'SO-PENDING',
    productName: '月卡',
    quantity: 1,
    amountInCents: 990,
    status: 'pending',
    provider: 'webhook',
    contactEmail: 'a@b.c',
    contactPhone: null,
    contactWechat: null,
    paymentNote: null,
    paidAt: null,
    fulfilledAt: null,
    createdAt: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 2,
    orderNo: 'SO-DONE',
    productName: '季卡',
    quantity: 2,
    amountInCents: 2990,
    status: 'fulfilled',
    provider: 'yipay',
    contactEmail: 'a@b.c',
    contactPhone: null,
    contactWechat: null,
    paymentNote: 'tx-1',
    paidAt: '2026-03-02T00:00:00.000Z',
    fulfilledAt: '2026-03-02T01:00:00.000Z',
    createdAt: '2026-03-01T12:00:00.000Z',
  },
]

test('订单页：确认收款（confirm）与重发邮件发出请求', async () => {
  const calls: Array<{ method: string; url: string }> = []
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    calls.push({ method: init?.method ?? 'GET', url })
    if (init?.method) return ok({ success: true, message: 'ok' })
    return ok({ orders })
  }) as unknown as typeof fetch

  render(React.createElement(ShopOrdersPage, {}))
  const pendingRow = await screen.findByText('SO-PENDING')
  assert.ok(pendingRow)

  // 行内确认收款（native confirm 被 helper 默认接受）
  fireEvent.click(screen.getByRole('button', { name: '确认收款发卡' }))
  await waitFor(() => {
    assert.ok(calls.some((c) => c.url.includes('/orders/SO-PENDING/confirm')))
  })

  // 打开已发卡订单抽屉 → 重发邮件
  fireEvent.click(screen.getByText('SO-DONE'))
  const drawer = await screen.findByRole('dialog')
  assert.ok(drawer.textContent!.includes('投递信息'))
  fireEvent.click(screen.getByRole('button', { name: '重发邮件' }))
  await waitFor(() => {
    assert.ok(calls.some((c) => c.url.includes('/orders/SO-DONE/resend-email')))
  })
})

test('订单页：清理超时订单走确认弹框', async () => {
  const calls: Array<{ method: string; url: string }> = []
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    calls.push({ method: init?.method ?? 'GET', url })
    if (init?.method === 'POST' && url.includes('/cleanup')) return ok({ success: true, message: '清理完成' })
    return ok({ orders })
  }) as unknown as typeof fetch

  render(React.createElement(ShopOrdersPage, {}))
  fireEvent.click(await screen.findByRole('button', { name: '清理超时订单' }))
  const dialog = await screen.findByRole('dialog')
  assert.ok(dialog.textContent!.includes('30 分钟'))
  fireEvent.click(screen.getByRole('button', { name: '确认清理' }))
  await waitFor(() => {
    assert.ok(calls.some((c) => c.url.includes('/api/admin/shop/orders/cleanup')))
  })
})

test('license-codes-export：展示标签函数', () => {
  const code = {
    id: 1,
    code: 'X',
    isUsed: false,
    usedAt: null,
    usedBy: null,
    createdAt: '2026-03-01T00:00:00.000Z',
    expiresAt: null,
    validDays: 30,
    cardType: null,
    projectId: 1,
    licenseMode: 'TIME' as const,
    totalCount: null,
    remainingCount: null,
    consumedCount: 0,
    allowAutoRebind: null,
    autoRebindCooldownMinutes: null,
    autoRebindMaxCount: null,
    lastBoundAt: null,
    lastRebindAt: null,
    rebindCount: 0,
    autoRebindCount: 0,
  }
  assert.equal(getProjectDisplayName(code), '默认项目')
  assert.equal(getLicenseModeLabel('TIME'), '时间型')
  assert.equal(getLicenseModeLabel('COUNT'), '次数型')
  assert.equal(getSpecLabel({ ...code, licenseMode: 'COUNT', totalCount: 10 }), '10 次')
  assert.equal(getSpecLabel({ ...code, cardType: '月卡' }), '月卡')
  assert.equal(getSpecLabel({ ...code }), '30天')
  assert.equal(getExpiryLabel({ ...code, licenseMode: 'COUNT' }), '-')
  assert.equal(getExpiryLabel({ ...code }), '30天（激活后生效）')
})

test('dashboard-page-types：cardTypes 覆盖六种套餐', () => {
  assert.equal(cardTypes.length, 6)
  assert.equal(cardTypes[cardTypes.length - 1].name, '自定义')
  assert.equal(cardTypes[0].days, 7)
})
