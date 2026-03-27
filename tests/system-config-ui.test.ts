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
    key: 'allowAutoRebind',
    value: true,
    description: '是否允许自动换绑',
  },
  {
    key: 'autoRebindCooldownMinutes',
    value: 60,
    description: '自动换绑冷却时间',
  },
  {
    key: 'autoRebindMaxCount',
    value: 3,
    description: '自动换绑次数上限',
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

test('buildSystemConfigPageModel 会按访问控制、换绑策略、认证安全和系统展示分组', () => {
  const model = buildSystemConfigPageModel([
    systemConfigs[0],
    systemConfigs[7],
    systemConfigs[1],
    systemConfigs[5],
    systemConfigs[2],
    systemConfigs[6],
    systemConfigs[3],
    systemConfigs[4],
  ])

  assert.deepEqual(
    model.groups.map((group) => group.key),
    ['access', 'rebind', 'security', 'branding'],
  )
  assert.deepEqual(
    model.groups[0].items.map((item) => item.key),
    ['allowedIPs'],
  )
  assert.deepEqual(
    model.groups[1].items.map((item) => item.key),
    ['allowAutoRebind', 'autoRebindCooldownMinutes', 'autoRebindMaxCount'],
  )
  assert.deepEqual(
    model.groups[2].items.map((item) => item.key),
    ['jwtSecret', 'jwtExpiresIn', 'bcryptRounds'],
  )
  assert.deepEqual(
    model.groups[3].items.map((item) => item.key),
    ['systemName'],
  )
})

test('buildSystemConfigPageModel 会补充用于设置页展示的预览、系统级换绑文案与推荐元数据', () => {
  const model = buildSystemConfigPageModel(systemConfigs)
  const accessItem = model.groups[0].items[0]
  const rebindItems = model.groups[1].items
  const autoRebindSwitchItem = rebindItems.find((item) => item.key === 'allowAutoRebind')
  const autoRebindCooldownItem = rebindItems.find(
    (item) => item.key === 'autoRebindCooldownMinutes',
  )
  const autoRebindMaxCountItem = rebindItems.find(
    (item) => item.key === 'autoRebindMaxCount',
  )
  const securityItems = model.groups[2].items
  const jwtSecretItem = securityItems.find((item) => item.key === 'jwtSecret')
  const jwtExpiresInItem = securityItems.find((item) => item.key === 'jwtExpiresIn')
  const bcryptRoundsItem = securityItems.find((item) => item.key === 'bcryptRounds')

  assert.equal(accessItem.layout, 'full')
  assert.deepEqual(accessItem.previewTokens, ['127.0.0.1', '::1'])
  assert.deepEqual(accessItem.badges, [{ label: '2 个地址', tone: 'info' }])
  assert.equal(autoRebindSwitchItem?.label, '系统级自助换绑策略')
  assert.match(autoRebindSwitchItem?.description || '', /系统级默认规则/)
  assert.match(autoRebindSwitchItem?.hint || '', /系统级配置 < 项目级配置 < 单码级配置/)
  assert.deepEqual(autoRebindSwitchItem?.badges, [{ label: '允许自助换绑', tone: 'success' }])
  assert.equal(autoRebindCooldownItem?.label, '系统级换绑冷却时间')
  assert.deepEqual(autoRebindCooldownItem?.badges, [{ label: '短冷却', tone: 'info' }])
  assert.equal(autoRebindMaxCountItem?.label, '系统级自助换绑次数上限')
  assert.deepEqual(autoRebindMaxCountItem?.badges, [{ label: '限制较严', tone: 'info' }])

  assert.equal(jwtSecretItem?.layout, 'full')
  assert.deepEqual(jwtSecretItem?.badges, [{ label: '敏感配置', tone: 'danger' }])

  assert.deepEqual(jwtExpiresInItem?.badges, [{ label: '推荐时长', tone: 'success' }])
  assert.deepEqual(bcryptRoundsItem?.badges, [{ label: '推荐强度', tone: 'success' }])
})

test('buildSystemConfigPageModel 会为脱敏敏感配置补充已配置状态，且不回显真实内容', () => {
  const model = buildSystemConfigPageModel([
    systemConfigs[0],
    {
      key: 'jwtSecret',
      value: '',
      description: 'JWT密钥',
      sensitive: true,
      masked: true,
      hasValue: true,
    },
    systemConfigs[2],
    systemConfigs[3],
    systemConfigs[4],
  ])
  const jwtSecretItem = model.groups
    .flatMap((group) => group.items)
    .find((item) => item.key === 'jwtSecret')

  assert.ok(jwtSecretItem)
  assert.equal(jwtSecretItem.value, '')
  assert.equal(Reflect.get(jwtSecretItem, 'masked'), true)
  assert.equal(Reflect.get(jwtSecretItem, 'hasValue'), true)
  assert.deepEqual(jwtSecretItem.badges, [
    { label: '敏感配置', tone: 'danger' },
    { label: '已配置', tone: 'success' },
  ])
  assert.match(jwtSecretItem.hint, /留空|保持不变|已配置/)
})

test('buildSystemConfigPageModel 会生成设置页顶部摘要信息', () => {
  const model = buildSystemConfigPageModel(systemConfigs)

  assert.deepEqual(model.summaryCards, [
    {
      label: '配置项',
      value: '8',
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
