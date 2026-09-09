import assert from 'node:assert/strict'
import test from 'node:test'

import {
  normalizeSystemConfigUpdates,
  InvalidSystemConfigPayloadError,
} from '../src/lib/system-config-write'
import { prepareSystemConfigUpdates } from '../src/lib/system-config-updates'
import {
  buildSystemConfigPageModel,
  type SystemConfigItem,
} from '../src/lib/system-config-ui'
import {
  sanitizeSystemConfigsForAdmin,
} from '../src/lib/config-service'
import { defaultSystemConfigs } from '../src/lib/system-config-defaults'

const notificationKeys = [
  'notifyWebhookUrl',
  'notifyEmailSmtpHost',
  'notifyEmailSmtpPort',
  'notifyEmailSmtpUser',
  'notifyEmailSmtpPass',
  'notifyEmailFrom',
  'notifyEmailTo',
  'notifySmsApiUrl',
  'notifySmsApiBody',
  'notifySmsPhones',
]

test('默认系统配置种子包含全部通知渠道配置项', () => {
  const keys = defaultSystemConfigs.map((config) => config.key)
  for (const key of notificationKeys) {
    assert.ok(keys.includes(key as (typeof keys)[number]), `缺少配置项 ${key}`)
  }
})

test('normalizeSystemConfigUpdates 接受通知配置并规范化', () => {
  const normalized = normalizeSystemConfigUpdates([
    { key: 'notifyWebhookUrl', value: '  https://notify.example.com/hook  ' },
    { key: 'notifyEmailSmtpHost', value: ' smtp.example.com ' },
    { key: 'notifyEmailSmtpPort', value: 587 },
    { key: 'notifyEmailSmtpPass', value: 'auth-code' },
    { key: 'notifySmsPhones', value: '' },
  ])

  assert.equal(normalized[0].value, 'https://notify.example.com/hook')
  assert.equal(normalized[1].value, 'smtp.example.com')
  assert.equal(normalized[2].value, 587)
  assert.equal(normalized[3].value, 'auth-code')
  assert.equal(normalized[4].value, '')
})

test('normalizeSystemConfigUpdates 拒绝非 http/https 的通知 Webhook', () => {
  assert.throws(
    () => normalizeSystemConfigUpdates([{ key: 'notifyWebhookUrl', value: 'file:///etc/passwd' }]),
    (error: unknown) => {
      assert.ok(error instanceof InvalidSystemConfigPayloadError)
      assert.equal(error.messageKey, 'sysconf.notifyWebhookUrlProtocol')
      assert.match(error.message, /http\/https 地址/)
      return true
    },
  )
})
test('normalizeSystemConfigUpdates 拒绝越界的 SMTP 端口', () => {
  assert.throws(
    () => normalizeSystemConfigUpdates([{ key: 'notifyEmailSmtpPort', value: 0 }]),
    (error: unknown) => {
      assert.ok(error instanceof InvalidSystemConfigPayloadError)
      assert.equal(error.messageKey, 'sysconf.smtpPortRange')
      return true
    },
  )
  assert.throws(
    () => normalizeSystemConfigUpdates([{ key: 'notifyEmailSmtpPort', value: 70000 }]),
    (error: unknown) => {
      assert.ok(error instanceof InvalidSystemConfigPayloadError)
      assert.equal(error.messageKey, 'sysconf.smtpPortRange')
      return true
    },
  )
  assert.throws(
    () => normalizeSystemConfigUpdates([{ key: 'notifyEmailSmtpPort', value: '465' }]),
    (error: unknown) => {
      assert.ok(error instanceof InvalidSystemConfigPayloadError)
      assert.equal(error.messageKey, 'sysconf.mustBeInteger')
      return true
    },
  )
})

test('敏感的 SMTP 授权码在后台读取时被掩码，且空值提交不覆盖旧值', () => {
  const configs: SystemConfigItem[] = [
    { key: 'notifyEmailSmtpPass', value: 'saved-auth-code', description: 'SMTP 授权码' },
  ]

  const sanitized = sanitizeSystemConfigsForAdmin(configs)
  assert.equal(sanitized[0].sensitive, true)
  assert.equal(sanitized[0].masked, true)
  assert.equal(sanitized[0].hasValue, true)
  assert.equal(sanitized[0].value, '')

  // 掩码后前端回传空字符串 → prepareSystemConfigUpdates 丢弃，不覆盖旧值
  const updates = prepareSystemConfigUpdates([{ ...sanitized[0], value: '' }])
  assert.deepEqual(updates, [])
})

test('buildSystemConfigPageModel 生成通知与告警分组并按序排列', () => {
  const notificationConfigs: SystemConfigItem[] = notificationKeys.map((key) => ({
    key,
    value: key === 'notifyEmailSmtpPort' ? 465 : '',
    description: key,
  }))

  const model = buildSystemConfigPageModel(notificationConfigs)

  assert.deepEqual(model.groups.map((group) => group.key), ['notification'])
  assert.deepEqual(
    model.groups[0].items.map((item) => item.key),
    [
      'notifyWebhookUrl',
      'notifyEmailSmtpHost',
      'notifyEmailSmtpPort',
      'notifyEmailSmtpUser',
      'notifyEmailSmtpPass',
      'notifyEmailFrom',
      'notifyEmailTo',
      'notifySmsApiUrl',
      'notifySmsApiBody',
      'notifySmsPhones',
    ],
  )

  const webhookItem = model.groups[0].items[0]
  assert.equal(webhookItem.inputKind, 'text')
  assert.deepEqual(webhookItem.badges, [{ label: '未启用', tone: 'warning' }])

  const passItem = model.groups[0].items.find((item) => item.key === 'notifyEmailSmtpPass')
  assert.equal(passItem?.inputKind, 'password')
  assert.equal(passItem?.sensitive, true)
})
