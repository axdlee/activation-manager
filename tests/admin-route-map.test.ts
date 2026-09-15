import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ADMIN_ROUTES,
  LEGACY_ADMIN_TAB_ROUTES,
  resolveLegacyAdminTab,
} from '../src/lib/admin-route-map'

test('旧 dashboard tab 映射到任务型后台 pathname', () => {
  const expected = {
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
  } as const

  assert.deepEqual(LEGACY_ADMIN_TAB_ROUTES, expected)

  for (const [tab, pathname] of Object.entries(expected)) {
    assert.equal(resolveLegacyAdminTab(tab), pathname)
  }
})

test('未知或缺失的旧 tab 回退到概览', () => {
  assert.equal(resolveLegacyAdminTab(null), ADMIN_ROUTES.overview)
  assert.equal(resolveLegacyAdminTab(''), ADMIN_ROUTES.overview)
  assert.equal(resolveLegacyAdminTab('not-a-tab'), ADMIN_ROUTES.overview)
})

test('changePassword 映射到独立账户安全页', () => {
  assert.equal(resolveLegacyAdminTab('changePassword'), '/admin/settings/security')
})

test('解析结果只包含新 pathname，不保留旧 tab query', () => {
  for (const tab of Object.keys(LEGACY_ADMIN_TAB_ROUTES)) {
    const pathname = resolveLegacyAdminTab(tab)
    assert.equal(pathname.includes('?'), false)
    assert.equal(pathname.includes('tab='), false)
  }
})
