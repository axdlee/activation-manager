'use client'

import * as React from 'react'

import { AdminShell } from '@/components/admin/admin-shell'
import { ShopPaymentPage } from '@/components/admin/shop-payment-page'
import { useOptionalToast } from '@/components/toast-provider'

export default function AdminShopPaymentPage() {
  const { toast } = useOptionalToast()

  return (
    <AdminShell activeTab="shop">
      <ShopPaymentPage
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
