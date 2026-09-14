'use client'

import * as React from 'react'

import { AdminShell } from '@/components/admin/admin-shell'
import { ShopOrdersPage } from '@/components/admin/shop-orders-page'
import { useOptionalToast } from '@/components/toast-provider'

export default function AdminShopOrdersPage() {
  const { toast } = useOptionalToast()

  return (
    <AdminShell activeTab="shop">
      <ShopOrdersPage
        onNotify={(message, type = 'success') => {
          if (!toast) return
          if (type === 'error') {
            toast.error(message)
          } else {
            toast.success(message)
          }
        }}
      />
    </AdminShell>
  )
}
