'use client'

import type { DashboardTabKey } from '@/lib/dashboard-tab-config'
import DashboardPage from '@/components/admin/legacy-dashboard-page'

type CanonicalAdminPageProps = {
  tab: DashboardTabKey
  shopTab?: 'products' | 'orders' | 'channels'
}

/**
 * Transitional page shell used while the task-oriented routes are rolled out.
 * It deliberately delegates business data loading and rendering to the proven
 * dashboard workspaces; later tasks can replace each tab without changing URLs.
 */
export function CanonicalAdminPage({ tab, shopTab }: CanonicalAdminPageProps) {
  return <DashboardPage initialTab={tab} shopTab={shopTab} />
}
