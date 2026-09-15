export const ADMIN_ROUTES = {
  overview: '/admin/overview',
  projects: '/admin/projects',
  generate: '/admin/licenses/generate',
  licenses: '/admin/licenses',
  consumptions: '/admin/consumptions',
  audit: '/admin/audit',
  integration: '/admin/integration',
  shopProducts: '/admin/shop/products',
  shopOrders: '/admin/shop/orders',
  shopPayment: '/admin/shop/payment',
  settings: '/admin/settings',
  security: '/admin/settings/security',
} as const

export type AdminRoute = (typeof ADMIN_ROUTES)[keyof typeof ADMIN_ROUTES]

/**
 * Compatibility mapping for the tab values used by the original dashboard.
 *
 * Keep this mapping in one place so links, redirects, and tests all agree on
 * the canonical task-oriented pathname for a legacy dashboard tab.
 */
export const LEGACY_ADMIN_TAB_ROUTES = {
  stats: ADMIN_ROUTES.overview,
  projects: ADMIN_ROUTES.projects,
  generate: ADMIN_ROUTES.generate,
  list: ADMIN_ROUTES.licenses,
  consumptions: ADMIN_ROUTES.consumptions,
  auditLogs: ADMIN_ROUTES.audit,
  apiDocs: ADMIN_ROUTES.integration,
  shop: ADMIN_ROUTES.shopProducts,
  systemConfig: ADMIN_ROUTES.settings,
  changePassword: ADMIN_ROUTES.security,
} as const satisfies Record<string, AdminRoute>

export type LegacyAdminTab = keyof typeof LEGACY_ADMIN_TAB_ROUTES

/**
 * Resolve a legacy `?tab=` value to a canonical admin pathname.
 *
 * The old query string is intentionally not copied to the new URL. This
 * prevents a stale tab value from becoming a second source of navigation
 * state after the redirect.
 */
export function resolveLegacyAdminTab(tab: string | null): AdminRoute {
  if (!tab) {
    return ADMIN_ROUTES.overview
  }

  return LEGACY_ADMIN_TAB_ROUTES[tab as LegacyAdminTab] ?? ADMIN_ROUTES.overview
}
