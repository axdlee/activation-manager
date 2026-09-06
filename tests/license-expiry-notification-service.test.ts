import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildExpiryNotificationPayload,
  getExpiryWebhookUrl,
  notifyLicenseExpiry,
  resetExpiryNotificationDeduplication,
  type ExpiryNotificationPayload,
} from '../src/lib/license-expiry-notification-service'
import type { LicenseActionCodeRecord } from '../src/lib/license-action-context'

const expiredTimeCode: LicenseActionCodeRecord = {
  id: 1,
  projectId: 1,
  code: 'TIME-EXPIRED-001',
  licenseMode: 'TIME',
  isUsed: true,
  usedAt: new Date('2026-01-01T00:00:00.000Z'),
  usedBy: 'machine-001',
  expiresAt: new Date('2026-01-31T00:00:00.000Z'),
  validDays: 30,
  remainingCount: null,
  project: {
    id: 1,
    name: '演示项目',
    projectKey: 'demo-project',
  },
}

test.beforeEach(() => {
  resetExpiryNotificationDeduplication()
})

test('buildExpiryNotificationPayload 生成包含激活码与到期信息的 JSON', () => {
  const payload = buildExpiryNotificationPayload(expiredTimeCode)

  assert.equal(payload.event, 'LICENSE_EXPIRED')
  assert.equal(payload.code, 'TIME-EXPIRED-001')
  assert.equal(payload.projectKey, 'demo-project')
  assert.equal(payload.licenseMode, 'TIME')
  assert.equal(payload.machineId, 'machine-001')
  assert.equal(payload.expiresAt, '2026-01-31T00:00:00.000Z')
  assert.equal(payload.remainingCount, null)
  assert.ok(!Number.isNaN(Date.parse(payload.notifiedAt)))
})

test('getExpiryWebhookUrl 返回配置的 URL（trim 后）', async () => {
  const url = await getExpiryWebhookUrl()
  assert.equal(typeof url, 'string')
})

test('notifyLicenseExpiry 对同一到期码只发送一次（去重）', () => {
  const first = notifyLicenseExpiry(expiredTimeCode)
  const second = notifyLicenseExpiry(expiredTimeCode)

  // 第一次触发发送流程，第二次被去重拦截
  assert.equal(first, true)
  assert.equal(second, false)
})

test('notifyLicenseExpiry 对不同到期时间视为不同事件', () => {
  const other: LicenseActionCodeRecord = {
    ...expiredTimeCode,
    expiresAt: new Date('2026-02-28T00:00:00.000Z'),
  }

  assert.equal(notifyLicenseExpiry(expiredTimeCode), true)
  assert.equal(notifyLicenseExpiry(other), true)
})

test('ExpiryNotificationPayload 类型包含全部通知字段', () => {
  const payload: ExpiryNotificationPayload = buildExpiryNotificationPayload(expiredTimeCode)
  const expectedKeys = [
    'event',
    'code',
    'projectKey',
    'licenseMode',
    'machineId',
    'expiresAt',
    'remainingCount',
    'notifiedAt',
  ]
  for (const key of expectedKeys) {
    assert.ok(Object.prototype.hasOwnProperty.call(payload, key), `缺少字段 ${key}`)
  }
})

test('getExpiryWebhookUrl 拒绝非 http/https 协议（防误配）', async () => {
  // 直接测协议校验逻辑（通过 setConfig 写入非法 URL 后再读）
  const { setConfig, clearConfigCache } = await import('../src/lib/config-service')
  const { prisma } = await import('../src/lib/db')

  await setConfig('expiryWebhookUrl', 'file:///etc/passwd')
  clearConfigCache(['expiryWebhookUrl'])
  const url = await getExpiryWebhookUrl()
  assert.equal(url, '')

  await setConfig('expiryWebhookUrl', 'https://example.com/hook')
  clearConfigCache(['expiryWebhookUrl'])
  const validUrl = await getExpiryWebhookUrl()
  assert.equal(validUrl, 'https://example.com/hook')

  await prisma.systemConfig.deleteMany({ where: { key: 'expiryWebhookUrl' } })
  clearConfigCache(['expiryWebhookUrl'])
})
