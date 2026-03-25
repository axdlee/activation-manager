import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildAdminAuthValidationUrl,
  resolveAdminPageAuthMode,
  resolveAdminPageGuardAction,
} from '../src/lib/admin-page-guard'

test('resolveAdminPageAuthMode 会区分登录页与受保护后台页', () => {
  assert.equal(resolveAdminPageAuthMode('/'), null)
  assert.equal(resolveAdminPageAuthMode('/admin/login'), 'public')
  assert.equal(resolveAdminPageAuthMode('/admin/dashboard'), 'protected')
  assert.equal(resolveAdminPageAuthMode('/admin/projects'), 'protected')
})

test('buildAdminAuthValidationUrl 会为不同页面模式生成统一校验地址', () => {
  assert.equal(
    buildAdminAuthValidationUrl('https://example.com/admin/dashboard', 'protected').toString(),
    'https://example.com/api/admin/auth/validate?mode=protected',
  )
  assert.equal(
    buildAdminAuthValidationUrl('https://example.com/admin/login', 'public').toString(),
    'https://example.com/api/admin/auth/validate?mode=public',
  )
})

test('resolveAdminPageGuardAction 在受保护页面收到 401 时会重定向到登录页', () => {
  const action = resolveAdminPageGuardAction(
    'protected',
    {
      success: false,
      code: 'token_invalid',
      error: '无效的认证令牌',
      status: 401,
    },
    'https://example.com/admin/dashboard',
  )

  assert.deepEqual(action, {
    type: 'redirect',
    location: 'https://example.com/admin/login',
  })
})

test('resolveAdminPageGuardAction 在白名单拒绝时会返回原地错误响应', () => {
  const action = resolveAdminPageGuardAction(
    'public',
    {
      success: false,
      code: 'ip_not_allowed',
      error: '访问被拒绝: IP地址不在白名单中',
      status: 403,
    },
    'https://example.com/admin/login',
  )

  assert.deepEqual(action, {
    type: 'response',
    status: 403,
    message: '访问被拒绝: IP地址不在白名单中',
  })
})
