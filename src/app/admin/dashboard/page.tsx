import { redirect } from 'next/navigation'

import { resolveLegacyAdminTab } from '@/lib/admin-route-map'

type LegacyDashboardPageProps = {
  searchParams?: {
    tab?: string | string[]
  }
}

/**
 * Compatibility entry for the pre-redesign dashboard.
 *
 * The old URL remains valid for bookmarks and existing e2e coverage, while
 * the canonical task-oriented route owns the actual experience.
 */
export default function LegacyDashboardPage({ searchParams }: LegacyDashboardPageProps) {
  const rawTab = searchParams?.tab
  const tab = Array.isArray(rawTab) ? rawTab[0] ?? null : rawTab ?? null

  redirect(resolveLegacyAdminTab(tab))
}
