import assert from 'node:assert/strict'
import test from 'node:test'

import { config as appConfig } from '../src/config'
import { buildDefaultSystemConfigs } from '../src/lib/system-config-defaults'

test('buildDefaultSystemConfigs 在开发环境下仍会提供默认 jwtSecret 以保障本地初始化体验', () => {
  const systemConfigs = buildDefaultSystemConfigs({
    nodeEnv: 'development',
  })

  const jwtSecretConfig = systemConfigs.find((config) => config.key === 'jwtSecret')

  assert.ok(jwtSecretConfig)
  assert.equal(jwtSecretConfig.value, appConfig.jwt.secret)
})

test('buildDefaultSystemConfigs 在生产环境下不会注入仓库默认 jwtSecret', () => {
  const systemConfigs = buildDefaultSystemConfigs({
    nodeEnv: 'production',
  })

  assert.equal(systemConfigs.some((config) => config.key === 'jwtSecret'), false)
})

test('buildDefaultSystemConfigs 在生产环境下会优先使用显式提供的 JWT_SECRET', () => {
  const systemConfigs = buildDefaultSystemConfigs({
    nodeEnv: 'production',
    jwtSecretEnv: 'prod-jwt-secret',
  })

  assert.deepEqual(systemConfigs.find((config) => config.key === 'jwtSecret'), {
    key: 'jwtSecret',
    value: 'prod-jwt-secret',
    description: 'JWT密钥',
  })
})

test('buildDefaultSystemConfigs 支持通过显式 ALLOWED_IPS 注入 Docker 场景白名单', () => {
  const systemConfigs = buildDefaultSystemConfigs({
    allowedIPsEnv: '127.0.0.1,::1,172.16.0.0/12',
  })

  assert.deepEqual(systemConfigs.find((config) => config.key === 'allowedIPs'), {
    key: 'allowedIPs',
    value: ['127.0.0.1', '::1', '172.16.0.0/12'],
    description: 'IP白名单列表',
  })
})
