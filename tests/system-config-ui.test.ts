import assert from 'node:assert/strict'
import test from 'node:test'

import { buildSystemConfigPageModel } from '../src/lib/system-config-ui'

const systemConfigs = [
  {
    key: 'allowedIPs',
    value: ['127.0.0.1', '::1'],
    description: 'IP白名单列表',
  },
  {
    key: 'jwtSecret',
    value: 'secret-value',
    description: 'JWT密钥',
  },
  {
    key: 'jwtExpiresIn',
    value: '24h',
    description: 'JWT过期时间',
  },
  {
    key: 'bcryptRounds',
    value: 12,
    description: 'bcrypt加密强度',
  },
  {
    key: 'systemName',
    value: '激活码管理系统',
    description: '系统名称',
  },
]

test('buildSystemConfigPageModel 会按访问控制、认证安全和系统展示分组', () => {
  const model = buildSystemConfigPageModel([
    systemConfigs[2],
    systemConfigs[4],
    systemConfigs[0],
    systemConfigs[3],
    systemConfigs[1],
  ])

  assert.deepEqual(
    model.groups.map((group) => group.key),
    ['access', 'security', 'branding'],
  )
  assert.deepEqual(
    model.groups[0].items.map((item) => item.key),
    ['allowedIPs'],
  )
  assert.deepEqual(
    model.groups[1].items.map((item) => item.key),
    ['jwtSecret', 'jwtExpiresIn', 'bcryptRounds'],
  )
  assert.deepEqual(
    model.groups[2].items.map((item) => item.key),
    ['systemName'],
  )
})

test('buildSystemConfigPageModel 会补充用于设置页展示的预览与推荐元数据', () => {
  const model = buildSystemConfigPageModel(systemConfigs)
  const accessItem = model.groups[0].items[0]
  const securityItems = model.groups[1].items
  const jwtSecretItem = securityItems.find((item) => item.key === 'jwtSecret')
  const jwtExpiresInItem = securityItems.find((item) => item.key === 'jwtExpiresIn')
  const bcryptRoundsItem = securityItems.find((item) => item.key === 'bcryptRounds')

  assert.equal(accessItem.layout, 'full')
  assert.deepEqual(accessItem.previewTokens, ['127.0.0.1', '::1'])
  assert.deepEqual(accessItem.badges, [{ label: '2 个地址', tone: 'info' }])

  assert.equal(jwtSecretItem?.layout, 'full')
  assert.deepEqual(jwtSecretItem?.badges, [{ label: '敏感配置', tone: 'danger' }])

  assert.deepEqual(jwtExpiresInItem?.badges, [{ label: '推荐时长', tone: 'success' }])
  assert.deepEqual(bcryptRoundsItem?.badges, [{ label: '推荐强度', tone: 'success' }])
})

test('buildSystemConfigPageModel 会生成设置页顶部摘要信息', () => {
  const model = buildSystemConfigPageModel(systemConfigs)

  assert.deepEqual(model.summaryCards, [
    {
      label: '配置项',
      value: '5',
      description: '当前已加载的系统配置总数',
    },
    {
      label: '访问白名单',
      value: '2 个地址',
      description: '后台访问来源将按白名单限制',
    },
    {
      label: '登录会话',
      value: '24h',
      description: 'JWT 登录态有效期',
    },
    {
      label: '密码强度',
      value: '12 轮',
      description: 'bcrypt 哈希成本',
    },
  ])
})

test('buildSystemConfigPageModel 遇到未知配置时会归入高级配置分组', () => {
  const model = buildSystemConfigPageModel([
    ...systemConfigs,
    {
      key: 'customConfig',
      value: 'enabled',
      description: '自定义配置',
    },
  ])

  assert.equal(model.groups.at(-1)?.key, 'advanced')
  assert.deepEqual(model.groups.at(-1)?.items.map((item) => item.key), ['customConfig'])
})
