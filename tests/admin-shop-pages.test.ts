import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  formatPrice,
  getShopOrderStatusLabel,
  parseProviderConfig,
} from '../src/lib/shop-admin-data'
import { ShopSubnav } from '../src/components/admin/shop-subnav'
import { ShopProductDialog } from '../src/components/admin/shop-product-dialog'
import { ShopProductsPage } from '../src/components/admin/shop-products-page'
import { ShopOrdersPage } from '../src/components/admin/shop-orders-page'
import { ShopPaymentPage } from '../src/components/admin/shop-payment-page'

// ── 数据层 ─────────────────────────────────────────────────

test('shop-admin-data：价格格式化与渠道配置解析', () => {
  assert.equal(formatPrice(990), '¥9.90')
  assert.deepEqual(parseProviderConfig('{"gateway":"https://x"}'), { gateway: 'https://x' })
  assert.deepEqual(parseProviderConfig('not-json'), {})
  assert.equal(getShopOrderStatusLabel('fulfilled'), '已发卡')
})

// ── 子导航 ─────────────────────────────────────────────────

test('ShopSubnav：pathname 驱动 active，标签与旧 tab 一致', () => {
  const html = renderToStaticMarkup(React.createElement(ShopSubnav, { active: 'orders' }))

  assert.match(html, /商品管理/)
  assert.match(html, /订单管理/)
  assert.match(html, /支付渠道/)
  assert.match(html, /href="\/admin\/shop\/orders"/)
  assert.match(html, /aria-current="page"/)
})

// ── 商品 Dialog ────────────────────────────────────────────

function createProductDialogProps(
  overrides: Partial<React.ComponentProps<typeof ShopProductDialog>> = {},
) {
  return {
    open: true,
    onOpenChange: () => {},
    loading: false,
    mode: 'create' as const,
    projects: [{ id: 1, projectKey: 'default', name: '默认项目' }],
    editingProduct: null,
    createForm: {
      name: '',
      onNameChange: () => {},
      description: '',
      onDescriptionChange: () => {},
      projectId: '',
      onProjectIdChange: () => {},
      licenseMode: 'TIME',
      onLicenseModeChange: () => {},
      cardType: '',
      onCardTypeChange: () => {},
      validDays: '30',
      onValidDaysChange: () => {},
      totalCount: '',
      onTotalCountChange: () => {},
      price: '',
      onPriceChange: () => {},
      stockMode: 'DYNAMIC',
      onStockModeChange: () => {},
      onSubmit: () => {},
    },
    editForm: {
      name: '',
      onNameChange: () => {},
      description: '',
      onDescriptionChange: () => {},
      price: '',
      onPriceChange: () => {},
      isEnabled: true,
      onIsEnabledChange: () => {},
      onSubmit: () => {},
    },
    ...overrides,
  }
}

test('ShopProductDialog：create 模式保留旧占位符，首个 select 为所属项目', () => {
  const html = renderToStaticMarkup(React.createElement(ShopProductDialog, createProductDialogProps()))

  assert.match(html, /placeholder="商品名称（如 月卡）"/)
  assert.match(html, /placeholder="商品描述（可选）"/)
  assert.match(html, /placeholder="价格（元）"/)
  // DOM 顺序中第一个 select 是项目选择（e2e 用 select.first() 依赖此顺序）
  const firstSelect = html.indexOf('<select')
  assert.match(html.slice(firstSelect, firstSelect + 200), /shop-product-project/)
  assert.match(html, /创建商品/)
})

test('ShopProductDialog：edit 模式共用 Dialog 且只含基础字段', () => {
  const html = renderToStaticMarkup(
    React.createElement(
      ShopProductDialog,
      createProductDialogProps({
        mode: 'edit',
        editingProduct: {
          id: 1,
          name: '月卡',
          description: null,
          projectKey: 'default',
          licenseMode: 'TIME',
          cardType: null,
          validDays: 30,
          totalCount: null,
          priceInCents: 990,
          isEnabled: true,
          sortOrder: 0,
          stockMode: 'DYNAMIC',
        },
      }),
    ),
  )

  assert.match(html, /编辑商品/)
  assert.match(html, /保存商品/)
  assert.doesNotMatch(html, /shop-product-license-mode/)
})

// ── 商品页 ─────────────────────────────────────────────────

const products = [
  {
    id: 1,
    name: 'e2e月卡',
    description: '测试商品',
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

test('ShopProductsPage：列表优先——单 h1、表格、新建入口、更多菜单', () => {
  const html = renderToStaticMarkup(
    React.createElement(ShopProductsPage, {
      initialProducts: products,
      initialProjects: [{ id: 1, projectKey: 'default', name: '默认项目' }],
    }),
  )

  assert.equal((html.match(/<h1/g) ?? []).length, 1)
  assert.match(html, /新建商品/)
  assert.match(html, /<table/)
  assert.match(html, /e2e月卡/)
  assert.match(html, /¥9\.90/)
  assert.match(html, /预定义码池/)
})

// ── 订单页 ─────────────────────────────────────────────────

const orders = [
  {
    id: 1,
    orderNo: 'SOABCD1234',
    productName: 'e2e月卡',
    quantity: 1,
    amountInCents: 990,
    status: 'pending',
    provider: 'webhook',
    contactEmail: 'buyer@example.com',
    contactPhone: null,
    contactWechat: null,
    paymentNote: null,
    paidAt: null,
    fulfilledAt: null,
    createdAt: '2026-03-01T00:00:00.000Z',
  },
]

test('ShopOrdersPage：状态/渠道筛选 + 行内确认收款 + 清理入口', () => {
  const html = renderToStaticMarkup(
    React.createElement(ShopOrdersPage, { initialOrders: orders }),
  )

  assert.match(html, /aria-label="订单状态筛选"/)
  assert.match(html, /aria-label="支付渠道筛选"/)
  assert.match(html, /SOABCD1234/)
  assert.match(html, /确认收款发卡/)
  assert.match(html, /清理超时订单/)
  assert.match(html, /待支付/)
})

// ── 支付渠道页 ─────────────────────────────────────────────

const configs = [
  { provider: 'yipay', configJson: '{"gateway":"https://pay.x","pid":"1","key":"k"}', isEnabled: true, configComplete: true, missingKeys: [] },
  { provider: 'wechat', configJson: '{}', isEnabled: false, configComplete: false, missingKeys: ['appId'] },
]

test('ShopPaymentPage：渠道卡展示 enabled/configComplete/missingKeys 与折叠配置', () => {
  const html = renderToStaticMarkup(
    React.createElement(ShopPaymentPage, { initialConfigs: configs }),
  )

  assert.match(html, /Webhook 回调/)
  assert.match(html, /易支付/)
  assert.match(html, /微信支付/)
  assert.match(html, /支付宝/)
  assert.match(html, /已启用/)
  assert.match(html, /未启用/)
  assert.match(html, /配置不完整/)
  assert.match(html, /appId/)
  assert.match(html, /配置完整/)
  // 敏感字段默认折叠（details 未展开时内容仍在 DOM，但密钥输入为 password 型）
  assert.match(html, /type="password"/)
})
