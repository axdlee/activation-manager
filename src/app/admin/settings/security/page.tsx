'use client'

import { AdminShell } from '@/components/admin/admin-shell'
import { SecurityPage } from '@/components/admin/security-page'

export default function AdminSecurityPage() {
  return (
    <AdminShell activeTab="changePassword">
      <SecurityPage />
    </AdminShell>
  )
}
