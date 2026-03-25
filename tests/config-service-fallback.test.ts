import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MissingRequiredSystemConfigError,
  resolveConfigValueWithFallback,
} from '../src/lib/config-service'
import { config as appConfig } from '../src/config'

test('resolveConfigValueWithFallback 在生产环境缺少 jwtSecret 时会 fail fast', () => {
  assert.throws(
    () =>
      resolveConfigValueWithFallback('jwtSecret', null, {
        nodeEnv: 'production',
      }),
    (error) =>
      error instanceof MissingRequiredSystemConfigError &&
      error.message.includes('jwtSecret'),
  )
})

test('resolveConfigValueWithFallback 在开发环境缺少 jwtSecret 时仍允许回退默认值', () => {
  const value = resolveConfigValueWithFallback('jwtSecret', null, {
    nodeEnv: 'development',
  })

  assert.equal(value, appConfig.jwt.secret)
})

test('resolveConfigValueWithFallback 在生产环境遇到全空格 jwtSecret 时同样会 fail fast', () => {
  assert.throws(
    () =>
      resolveConfigValueWithFallback('jwtSecret', '   ', {
        nodeEnv: 'production',
      }),
    (error) =>
      error instanceof MissingRequiredSystemConfigError &&
      error.message.includes('jwtSecret'),
  )
})

test('resolveConfigValueWithFallback 对非敏感配置仍保留原有默认回退行为', () => {
  const value = resolveConfigValueWithFallback('allowedIPs', null, {
    nodeEnv: 'production',
  })

  assert.deepEqual(value, appConfig.security.allowedIPs)
})
