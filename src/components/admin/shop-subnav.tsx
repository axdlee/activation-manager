'use client'

import * as React from 'react'
import Link from 'next/link'

import { useI18n } from '@/lib/i18n/i18n-provider'

export type ShopSubnavKey = 'products' | 'orders' | 'payment'

const SUBNAV_ITEMS: Array<{ key: ShopSubnavKey; href: string; labelKey: string; fallback: string }> = [
  { key: 'products', href: '/admin/shop/products', labelKey: 'shopadmin.tabProducts', fallback: '商品管理' },
  { key: 'orders', href: '/admin/shop/orders', labelKey: 'shopadmin.tabOrders', fallback: '订单管理' },
  { key: 'payment', href: '/admin/shop/payment', labelKey: 'shopadmin.tabChannels', fallback: '支付渠道' },
]

/**
 * 购买中心子导航：pathname 驱动 active（任务页各自独立加载，不在一个组件里同时拉三类数据）。
 * 标签文案与旧 tab 保持一致，旧 e2e 选择器继续可用。
 */
export function ShopSubnav({ active }: { active: ShopSubnavKey }) {
  const { t } = useI18n()

  return (
    <nav aria-label={t('shopadmin.subnavLabel', '购买中心')} className="flex flex-wrap items-center gap-2">
      {SUBNAV_ITEMS.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={active === item.key ? 'page' : undefined}
          className={`inline-flex h-10 items-center rounded-md px-4 text-sm font-medium transition ${
            active === item.key
              ? 'bg-primary text-primary-foreground shadow'
              : 'border border-input bg-background text-foreground/80 hover:bg-accent'
          }`}
        >
          {t(item.labelKey, item.fallback)}
        </Link>
      ))}
    </nav>
  )
}
