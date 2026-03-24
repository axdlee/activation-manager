import assert from 'node:assert/strict'
import test from 'node:test'

import { sanitizeSystemConfigsForAdmin } from '../src/lib/config-service'

test('sanitizeSystemConfigsForAdmin 会脱敏敏感配置，并保留已配置状态', () => {
  const sanitizedConfigs = sanitizeSystemConfigsForAdmin([
    {
      key: 'allowedIPs',
      value: ['127.0.0.1', '::1'],
      description: 'IP白名单列表',
    },
    {
      key: 'jwtSecret',
      value: 'real-jwt-secret',
      description: 'JWT密钥',
    },
  ])

  assert.deepEqual(sanitizedConfigs, [
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
  ])
})

test('sanitizeSystemConfigsForAdmin 会为未配置的敏感项返回未配置状态', () => {
  const [jwtSecretConfig] = sanitizeSystemConfigsForAdmin([
    {
      key: 'jwtSecret',
      value: '',
      description: 'JWT密钥',
    },
  ])

  assert.equal(jwtSecretConfig.value, '')
  assert.equal(jwtSecretConfig.sensitive, true)
  assert.equal(jwtSecretConfig.masked, true)
  assert.equal(jwtSecretConfig.hasValue, false)
})
