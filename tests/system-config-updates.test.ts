import assert from 'node:assert/strict'
import test from 'node:test'

import { prepareSystemConfigUpdates } from '../src/lib/system-config-updates'

test('prepareSystemConfigUpdates 会忽略未修改的敏感空值，并移除仅供 UI 使用的字段', () => {
  const updates = prepareSystemConfigUpdates([
    {
      key: 'allowedIPs',
      value: ['127.0.0.1', '::1'],
      description: 'IP白名单列表',
    },
    {
      key: 'jwtSecret',
      value: '',
      description: 'JWT密钥',
      sensitive: true,
      masked: true,
      hasValue: true,
    },
    {
      key: 'jwtExpiresIn',
      value: '24h',
      description: 'JWT过期时间',
    },
  ])

  assert.deepEqual(updates, [
    {
      key: 'allowedIPs',
      value: ['127.0.0.1', '::1'],
      description: 'IP白名单列表',
    },
    {
      key: 'jwtExpiresIn',
      value: '24h',
      description: 'JWT过期时间',
    },
  ])
})

test('prepareSystemConfigUpdates 会保留已填写的新敏感配置值', () => {
  const updates = prepareSystemConfigUpdates([
    {
      key: 'jwtSecret',
      value: 'new-jwt-secret',
      description: 'JWT密钥',
      sensitive: true,
      masked: true,
      hasValue: true,
    },
  ])

  assert.deepEqual(updates, [
    {
      key: 'jwtSecret',
      value: 'new-jwt-secret',
      description: 'JWT密钥',
    },
  ])
})
