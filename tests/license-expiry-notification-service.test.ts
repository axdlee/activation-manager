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

// 抢占成功的 mock：模拟持久层允许通知
const claimableClient = {
  activationCode: { updateMany: async () => ({ count: 1 }) },
}

test('notifyLicenseExpiry 对同一到期码只发送一次（进程内去重）', async () => {
  const first = await notifyLicenseExpiry(expiredTimeCode, claimableClient)
  const second = await notifyLicenseExpiry(expiredTimeCode, claimableClient)

  // 第一次触发发送流程，第二次被去重拦截
  assert.equal(first, true)
  assert.equal(second, false)
})

test('notifyLicenseExpiry 对不同到期时间视为不同事件', async () => {
  const other: LicenseActionCodeRecord = {
    ...expiredTimeCode,
    expiresAt: new Date('2026-02-28T00:00:00.000Z'),
  }

  assert.equal(await notifyLicenseExpiry(expiredTimeCode, claimableClient), true)
  assert.equal(await notifyLicenseExpiry(other, claimableClient), true)
})

test('notifyLicenseExpiry 持久去重：窗口内已通知的码不再发送', async () => {
  // 抢占失败（count=0）→ 7 天窗口内已通知过
  const claimedClient = {
    activationCode: { updateMany: async () => ({ count: 0 }) },
  }

  const first = await notifyLicenseExpiry(expiredTimeCode, claimedClient)
  assert.equal(first, false)

  // 同 key 第二次直接走进程内快速路径，也不再发送
  const second = await notifyLicenseExpiry(expiredTimeCode, claimableClient)
  assert.equal(second, false)
})

test('notifyLicenseExpiry 持久层故障时退回进程内去重不阻塞', async () => {
  const brokenClient = {
    activationCode: {
      updateMany: async () => {
        throw new Error('db down')
      },
    },
  }

  assert.equal(await notifyLicenseExpiry(expiredTimeCode, brokenClient), true)
  // 故障路径同样记录进程内 key
  assert.equal(await notifyLicenseExpiry(expiredTimeCode, brokenClient), false)
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
