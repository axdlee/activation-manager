import assert from 'node:assert/strict'
import test from 'node:test'

import { prisma } from '../src/lib/db'
import { bootstrapDevelopmentDatabase } from '../src/lib/dev-bootstrap'
import { clearConfigCache, setConfig } from '../src/lib/config-service'
import {
  setEmailTransportFactoryForTests,
  type MailTransportOptions,
  type MailTransporterLike,
} from '../src/lib/notification-email'
import {
  DEFAULT_SMS_BODY_TEMPLATE,
  getSmsNotificationConfig,
  isSmsNotificationConfigured,
  renderSmsBody,
  sendNotificationSms,
} from '../src/lib/notification-sms'
import {
  buildNotificationEnvelope,
  getNotificationWebhookUrl,
  runNotificationChannels,
  NOTIFICATION_EVENTS,
  type NotificationContent,
} from '../src/lib/notification-service'
import {
  getEmailNotificationConfig,
  isEmailNotificationConfigured,
  sendEmail,
  sendNotificationEmail,
} from '../src/lib/notification-email'
import {
  notifyLicenseExpiryEvent,
  notifyShopOrderFulfilledEvent,
  notifyShopOrderTimeoutCancelledEvent,
  sendBuyerOrderFulfilledEmail,
} from '../src/lib/notification-events'
import { cancelExpiredPendingOrders } from '../src/lib/shop-order-cleanup-service'
import { fulfillShopOrder } from '../src/lib/shop-fulfillment-service'
import { generateShopOrderNo } from '../src/lib/shop-order-service'
import { resetExpiryNotificationDeduplication } from '../src/lib/license-expiry-notification-service'
import type { LicenseActionCodeRecord } from '../src/lib/license-action-context'

/**
 * 通知系统测试（合并单文件运行）：
 * 所有用例共享一个 SQLite system_configs 表，node --test 默认并行运行不同文件，
 * 因此通知相关用例集中在本文件内串行执行、每个用例自清理，避免跨文件竞态。
 */

const NOTIFY_CONFIG_KEYS = [
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

const silentLogger = { log: () => undefined, error: () => undefined }

function buildTestContent(overrides: Partial<NotificationContent> = {}): NotificationContent {
  return {
    event: NOTIFICATION_EVENTS.SHOP_ORDER_PAID_FULFILLED,
    title: '订单已发卡',
    body: '订单 SO-TEST 已发卡',
    data: { orderNo: 'SO-TEST' },
    ...overrides,
  }
}

async function writeConfig(key: string, value: string | number) {
  await setConfig(key, value)
  clearConfigCache([key])
}

type CapturedRequest = { url: string; body: Record<string, any> }

function installWebhookCapture(requests: CapturedRequest[]) {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), body: JSON.parse(String(init?.body)) as Record<string, any> })
    return new Response('{}', { status: 200 })
  }) as typeof fetch
  return () => {
    globalThis.fetch = originalFetch
  }
}

async function flushAsyncTasks() {
  await new Promise((resolve) => setImmediate(resolve))
  await new Promise((resolve) => setImmediate(resolve))
}

/**
 * 等待 fire-and-forget 通知完成（内部经过 Prisma 异步 I/O，
 * setImmediate 刷不清，用短轮询等待条件成立）。
 */
async function waitFor(condition: () => boolean, timeoutMs = 2000) {
  const start = Date.now()
  while (!condition()) {
    if (Date.now() - start > timeoutMs) {
      return false
    }
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  return true
}

async function seedOrderFixture(productOverrides: Record<string, unknown> = {}) {
  // 注意：不触碰 shopPaymentConfig——npm test 并行运行测试文件，
  // 其他文件（shop-order-service）也在操作该表，避免唯一键竞态。
  const defaultProject = await prisma.project.findFirstOrThrow({ where: { projectKey: 'default' } })
  const product = await prisma.shopProduct.create({
    data: {
      name: '通知测试商品',
      projectId: defaultProject.id,
      licenseMode: 'COUNT',
      cardType: '次卡',
      totalCount: 10,
      priceInCents: 500,
      isEnabled: true,
      stockMode: 'DYNAMIC',
      ...productOverrides,
    },
  })
  return { product, project: defaultProject }
}

/**
 * 直接通过 prisma 创建 pending 订单（绕过 createShopOrder 的支付渠道依赖）。
 */
async function createPendingOrder(
  productId: number,
  contactEmail: string,
  overrides: Record<string, unknown> = {},
) {
  return prisma.shopOrder.create({
    data: {
      orderNo: generateShopOrderNo(),
      productId,
      amountInCents: 500,
      contactEmail,
      status: 'pending',
      provider: 'manual',
      ...overrides,
    },
  })
}

const expiredTimeCode: LicenseActionCodeRecord = {
  id: 1,
  projectId: 1,
  code: 'TIME-EXPIRED-NOTIFY-001',
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

test.before(async () => {
  await bootstrapDevelopmentDatabase({ logger: silentLogger })
})

test.after(async () => {
  await prisma.$disconnect()
})

test.afterEach(async () => {
  await prisma.shopProductCodeStock.deleteMany({})
  await prisma.shopOrder.deleteMany({})
  await prisma.shopProduct.deleteMany({})
  await prisma.notificationLog.deleteMany({})
  await prisma.systemConfig.deleteMany({ where: { key: { in: NOTIFY_CONFIG_KEYS } } })
  clearConfigCache()
  setEmailTransportFactoryForTests(null)
  resetExpiryNotificationDeduplication()
})

// ---------- 通用分发（notification-service） ----------

test('getNotificationWebhookUrl 只接受 http/https 地址', async () => {
  await writeConfig('notifyWebhookUrl', '   ')
  assert.equal(await getNotificationWebhookUrl(), '')

  await writeConfig('notifyWebhookUrl', 'file:///etc/passwd')
  assert.equal(await getNotificationWebhookUrl(), '')

  await writeConfig('notifyWebhookUrl', ' https://notify.example.com/hook ')
  assert.equal(await getNotificationWebhookUrl(), 'https://notify.example.com/hook')
})

test('buildNotificationEnvelope 附带 notifiedAt 时间戳', () => {
  const envelope = buildNotificationEnvelope(buildTestContent())
  assert.equal(envelope.event, NOTIFICATION_EVENTS.SHOP_ORDER_PAID_FULFILLED)
  assert.ok(!Number.isNaN(Date.parse(envelope.notifiedAt)))
})

test('未配置任何渠道时 runNotificationChannels 全部跳过', async () => {
  const result = await runNotificationChannels(buildTestContent())

  assert.deepEqual(result.webhook, { sent: false, skipped: true })
  assert.equal(result.email.sent, false)
  assert.equal(result.email.attempted, false)
  assert.equal(result.sms.attempted, false)
  assert.equal(result.sms.sent, 0)
  assert.equal(result.sms.failed, 0)
})

test('notifyWebhookUrl 收到统一 envelope 结构', async () => {
  const requests: CapturedRequest[] = []
  const restoreFetch = installWebhookCapture(requests)

  try {
    await writeConfig('notifyWebhookUrl', 'https://notify.example.com/hook')
    const result = await runNotificationChannels(buildTestContent())

    assert.equal(result.webhook.sent, true)
    assert.equal(requests.length, 1)
    assert.equal(requests[0].url, 'https://notify.example.com/hook')
    assert.equal(requests[0].body.event, NOTIFICATION_EVENTS.SHOP_ORDER_PAID_FULFILLED)
    assert.equal(requests[0].body.data.orderNo, 'SO-TEST')
    assert.ok(typeof requests[0].body.notifiedAt === 'string')
  } finally {
    restoreFetch()
  }
})

test('LICENSE_EXPIRED 回落到旧到期接口且保持扁平 payload（显式注入地址）', async () => {
  const requests: CapturedRequest[] = []
  const restoreFetch = installWebhookCapture(requests)

  try {
    const result = await runNotificationChannels(
      buildTestContent({
        event: NOTIFICATION_EVENTS.LICENSE_EXPIRED,
        title: '激活码到期提醒',
        body: '激活码 TIME-001 已到期',
        data: { event: 'LICENSE_EXPIRED', code: 'TIME-001', remainingCount: null, notifiedAt: new Date().toISOString() },
      }),
      { legacyExpiryWebhookUrl: 'https://legacy.example.com/expiry' },
    )

    assert.equal(result.webhook.sent, true)
    assert.equal(result.webhook.viaLegacyExpiryWebhook, true)
    assert.equal(requests.length, 1)
    assert.equal(requests[0].url, 'https://legacy.example.com/expiry')
    // 兼容：旧接口收到原始扁平 payload，而非 envelope
    assert.equal(requests[0].body.code, 'TIME-001')
    assert.ok(typeof requests[0].body.notifiedAt === 'string')
    assert.equal(requests[0].body.title === undefined, true)
  } finally {
    restoreFetch()
  }
})

test('配置通用 Webhook 后 LICENSE_EXPIRED 优先走通用 Webhook', async () => {
  const requests: CapturedRequest[] = []
  const restoreFetch = installWebhookCapture(requests)

  try {
    await writeConfig('notifyWebhookUrl', 'https://notify.example.com/hook')

    await runNotificationChannels(
      buildTestContent({
        event: NOTIFICATION_EVENTS.LICENSE_EXPIRED,
        title: '到期',
        body: '到期',
        data: {},
      }),
      { legacyExpiryWebhookUrl: 'https://legacy.example.com/expiry' },
    )

    assert.equal(requests.length, 1)
    assert.equal(requests[0].url, 'https://notify.example.com/hook')
  } finally {
    restoreFetch()
  }
})

test('webhook 网络异常不影响整体分发且不抛异常', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => {
    throw new Error('network down')
  }) as typeof fetch

  try {
    await writeConfig('notifyWebhookUrl', 'https://notify.example.com/hook')
    const result = await runNotificationChannels(buildTestContent())
    assert.equal(result.webhook.sent, false)
  } finally {
    globalThis.fetch = originalFetch
  }
})

// ---------- 邮件渠道（notification-email） ----------

test('未配置 host 或收件人时邮件渠道视为未启用', async () => {
  assert.equal(await getEmailNotificationConfig(), null)

  await writeConfig('notifyEmailSmtpHost', 'smtp.example.com')
  assert.equal(await getEmailNotificationConfig(), null)

  await writeConfig('notifyEmailTo', 'admin@example.com')
  const config = await getEmailNotificationConfig()
  assert.ok(config)
  assert.equal(isEmailNotificationConfigured(config), true)
})

test('端口默认 465 且使用 SSL；非 465 端口关闭 SSL', async () => {
  await writeConfig('notifyEmailSmtpHost', 'smtp.example.com')
  await writeConfig('notifyEmailTo', 'a@example.com')

  assert.equal((await getEmailNotificationConfig())?.port, 465)
  assert.equal((await getEmailNotificationConfig())?.secure, true)

  await writeConfig('notifyEmailSmtpPort', 587)
  const config = await getEmailNotificationConfig()
  assert.equal(config?.port, 587)
  assert.equal(config?.secure, false)
})

test('收件人支持逗号/分号/换行分隔', async () => {
  await writeConfig('notifyEmailSmtpHost', 'smtp.example.com')
  await writeConfig('notifyEmailTo', 'a@example.com, b@example.com\nc@example.com;d@example.com')

  const config = await getEmailNotificationConfig()
  assert.deepEqual(config?.recipients, [
    'a@example.com',
    'b@example.com',
    'c@example.com',
    'd@example.com',
  ])
})

test('sendEmail 使用注入的 transport 并携带发件人/收件人/正文', async () => {
  await writeConfig('notifyEmailSmtpHost', 'smtp.example.com')
  await writeConfig('notifyEmailSmtpPort', 465)
  await writeConfig('notifyEmailSmtpUser', 'bot@example.com')
  await writeConfig('notifyEmailSmtpPass', 'secret-pass')
  await writeConfig('notifyEmailFrom', 'from@example.com')
  await writeConfig('notifyEmailTo', 'admin@example.com')

  const captured: Array<{ options: MailTransportOptions; mail: Record<string, unknown> }> = []
  const fakeTransporter: MailTransporterLike = {
    async sendMail(mailOptions) {
      return { accepted: mailOptions.to }
    },
  }

  setEmailTransportFactoryForTests((options) => ({
    async sendMail(mailOptions) {
      captured.push({ options, mail: mailOptions as Record<string, unknown> })
      return fakeTransporter.sendMail(mailOptions)
    },
  }))

  const sent = await sendEmail({
    to: ['admin@example.com'],
    subject: '测试通知',
    text: '正文内容',
  })

  assert.equal(sent, true)
  assert.equal(captured.length, 1)
  assert.equal(captured[0].options.host, 'smtp.example.com')
  assert.equal(captured[0].options.port, 465)
  assert.deepEqual(captured[0].options.auth, { user: 'bot@example.com', pass: 'secret-pass' })
  assert.equal(captured[0].mail.from, 'from@example.com')
  assert.equal(captured[0].mail.to, 'admin@example.com')
  assert.equal(captured[0].mail.subject, '测试通知')
  assert.equal(captured[0].mail.text, '正文内容')
})

test('未配置 SMTP 认证时 from 缺省回退到 SMTP 用户名', async () => {
  await writeConfig('notifyEmailSmtpHost', 'smtp.example.com')
  await writeConfig('notifyEmailTo', 'admin@example.com')
  await writeConfig('notifyEmailSmtpUser', 'bot@example.com')

  const captured: Array<Record<string, unknown>> = []
  setEmailTransportFactoryForTests(() => ({
    async sendMail(mailOptions) {
      captured.push(mailOptions as Record<string, unknown>)
      return {}
    },
  }))

  const sent = await sendEmail({ to: ['admin@example.com'], subject: 's', text: 't' })
  assert.equal(sent, true)
  assert.equal(captured[0].from, '"Activation Manager" <bot@example.com>')
})

test('sendNotificationEmail 未配置时返回 false；配置后正文附带结构化数据', async () => {
  const notConfigured = await sendNotificationEmail({ title: 't', body: 'b' })
  assert.equal(notConfigured, false)

  await writeConfig('notifyEmailSmtpHost', 'smtp.example.com')
  await writeConfig('notifyEmailTo', 'admin@example.com')

  const captured: Array<Record<string, unknown>> = []
  setEmailTransportFactoryForTests(() => ({
    async sendMail(mailOptions) {
      captured.push(mailOptions as Record<string, unknown>)
      return {}
    },
  }))

  const sent = await sendNotificationEmail({
    title: '订单已发卡',
    body: '订单 SO-1 已发卡',
    data: { orderNo: 'SO-1' },
  })

  assert.equal(sent, true)
  assert.equal(captured[0].subject, '订单已发卡')
  assert.match(String(captured[0].text), /订单 SO-1 已发卡/)
  assert.match(String(captured[0].text), /"orderNo": "SO-1"/)
})

test('transport 抛异常时 sendEmail 返回 false 不抛出', async () => {
  await writeConfig('notifyEmailSmtpHost', 'smtp.example.com')
  await writeConfig('notifyEmailTo', 'admin@example.com')

  setEmailTransportFactoryForTests(() => ({
    async sendMail() {
      throw new Error('smtp down')
    },
  }))

  const sent = await sendEmail({ to: ['admin@example.com'], subject: 's', text: 't' })
  assert.equal(sent, false)
})

// ---------- 短信渠道（notification-sms） ----------

test('renderSmsBody 替换 phone/content 占位符', () => {
  assert.equal(
    renderSmsBody(DEFAULT_SMS_BODY_TEMPLATE, '13800000000', '订单已发卡'),
    '{"phone":"13800000000","content":"订单已发卡"}',
  )
  assert.equal(renderSmsBody('phone={phone}&msg={content}', '139', 'hello'), 'phone=139&msg=hello')
  assert.equal(renderSmsBody('无占位符', '139', 'hello'), '无占位符')
})

test('未配置短信网关或手机号时视为未启用', async () => {
  assert.equal(await getSmsNotificationConfig(), null)

  await writeConfig('notifySmsApiUrl', 'https://sms.example.com/send')
  assert.equal(await getSmsNotificationConfig(), null)

  await writeConfig('notifySmsPhones', '13800000000')
  const config = await getSmsNotificationConfig()
  assert.ok(config)
  assert.equal(isSmsNotificationConfigured(config), true)
  // 未配置模板时回退默认 JSON 模板
  assert.equal(config?.bodyTemplate, DEFAULT_SMS_BODY_TEMPLATE)
})

test('手机号支持逗号/分号/换行分隔', async () => {
  await writeConfig('notifySmsApiUrl', 'https://sms.example.com/send')
  await writeConfig('notifySmsPhones', '13800000000, 13900000000\n137;136')

  const config = await getSmsNotificationConfig()
  assert.deepEqual(config?.phones, ['13800000000', '13900000000', '137', '136'])
})

test('sendNotificationSms 并行发送并统计成功/失败', async () => {
  await writeConfig('notifySmsApiUrl', 'https://sms.example.com/send')
  await writeConfig('notifySmsPhones', '13800000000,13900000000')

  const calls: Array<{ url: string; body: string }> = []
  const originalFetch = globalThis.fetch
  let failFirst = true
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), body: String(init?.body) })
    if (failFirst) {
      failFirst = false
      return new Response('err', { status: 500 })
    }
    return new Response('{"code":0}', { status: 200 })
  }) as typeof fetch

  try {
    const result = await sendNotificationSms({ content: '订单 SO-1 已发卡' })
    assert.deepEqual(result, { sent: 1, failed: 1 })
    assert.equal(calls.length, 2)
    assert.ok(calls.every((call) => call.url === 'https://sms.example.com/send'))
    assert.deepEqual(
      calls.map((call) => JSON.parse(call.body)).sort((a, b) => a.phone.localeCompare(b.phone)),
      [
        { phone: '13800000000', content: '订单 SO-1 已发卡' },
        { phone: '13900000000', content: '订单 SO-1 已发卡' },
      ],
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('sendNotificationSms 网络异常计入失败且不抛出', async () => {
  await writeConfig('notifySmsApiUrl', 'https://sms.example.com/send')
  await writeConfig('notifySmsPhones', '13800000000')

  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => {
    throw new Error('gateway down')
  }) as typeof fetch

  try {
    const result = await sendNotificationSms({ content: '测试' })
    assert.deepEqual(result, { sent: 0, failed: 1 })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('未配置短信渠道时 sendNotificationSms 直接跳过', async () => {
  const originalFetch = globalThis.fetch
  let called = false
  globalThis.fetch = (async () => {
    called = true
    return new Response('{}', { status: 200 })
  }) as typeof fetch

  try {
    const result = await sendNotificationSms({ content: '测试' })
    assert.deepEqual(result, { sent: 0, failed: 0 })
    assert.equal(called, false)
  } finally {
    globalThis.fetch = originalFetch
  }
})

// ---------- 事件适配（notification-events） ----------

test('notifyShopOrderFulfilledEvent 通过 webhook 分发发卡事件', async () => {
  const requests: CapturedRequest[] = []
  const restoreFetch = installWebhookCapture(requests)

  try {
    await writeConfig('notifyWebhookUrl', 'https://notify.example.com/hook')
    notifyShopOrderFulfilledEvent({
      orderNo: 'SO-EVT-001',
      productName: '月卡',
      amountInCents: 990,
      codes: ['CODE-1'],
      trigger: 'payment',
    })

    await waitFor(() => requests.length >= 1)

    assert.equal(requests.length, 1)
    assert.equal(requests[0].url, 'https://notify.example.com/hook')
    assert.equal(requests[0].body.event, 'SHOP_ORDER_PAID_FULFILLED')
    assert.equal(requests[0].body.data.orderNo, 'SO-EVT-001')
    assert.match(String(requests[0].body.body), /￥9\.90/)
  } finally {
    restoreFetch()
  }
})

test('notifyShopOrderTimeoutCancelledEvent 空列表不分发', async () => {
  const requests: CapturedRequest[] = []
  const restoreFetch = installWebhookCapture(requests)

  try {
    await writeConfig('notifyWebhookUrl', 'https://notify.example.com/hook')
    notifyShopOrderTimeoutCancelledEvent({ orderNos: [], timeoutMinutes: 30 })

    await new Promise((resolve) => setTimeout(resolve, 50))
    assert.equal(requests.length, 0)
  } finally {
    restoreFetch()
  }
})

test('sendBuyerOrderFulfilledEmail 未配置 SMTP 时返回 false', async () => {
  const sent = await sendBuyerOrderFulfilledEmail({
    to: 'buyer@example.com',
    orderNo: 'SO-BUYER-1',
    productName: '月卡',
    amountInCents: 990,
    codes: ['CODE-A'],
  })
  assert.equal(sent, false)
})

test('sendBuyerOrderFulfilledEmail 配置 SMTP 后把卡密发给买家邮箱', async () => {
  await writeConfig('notifyEmailSmtpHost', 'smtp.example.com')
  await writeConfig('notifyEmailSmtpUser', 'bot@example.com')
  await writeConfig('notifyEmailSmtpPass', 'pass')
  await writeConfig('notifyEmailTo', 'admin@example.com')

  const captured: Array<Record<string, unknown>> = []
  setEmailTransportFactoryForTests(() => ({
    async sendMail(mailOptions) {
      captured.push(mailOptions as Record<string, unknown>)
      return {}
    },
  }))

  const sent = await sendBuyerOrderFulfilledEmail({
    to: 'buyer@example.com',
    orderNo: 'SO-BUYER-2',
    productName: '月卡',
    amountInCents: 990,
    codes: ['CODE-A', 'CODE-B'],
  })

  assert.equal(sent, true)
  assert.equal(captured.length, 1)
  assert.equal(captured[0].to, 'buyer@example.com')
  assert.match(String(captured[0].subject), /月卡/)
  assert.match(String(captured[0].subject), /SO-BUYER-2/)
  const text = String(captured[0].text)
  assert.match(text, /1\. CODE-A/)
  assert.match(text, /2\. CODE-B/)
  assert.match(text, /￥9\.90/)
})

test('sendBuyerOrderFulfilledEmail 空收件人返回 false', async () => {
  await writeConfig('notifyEmailSmtpHost', 'smtp.example.com')
  await writeConfig('notifyEmailTo', 'admin@example.com')

  const sent = await sendBuyerOrderFulfilledEmail({
    to: '   ',
    orderNo: 'SO-BUYER-3',
    productName: '月卡',
    amountInCents: 990,
    codes: ['CODE-A'],
  })
  assert.equal(sent, false)
})

// ---------- 业务事件集成（到期 / 发卡 / 超时清理） ----------

test('notifyLicenseExpiryEvent 事件回落旧到期接口（保持扁平 payload 兼容）', async () => {
  await writeConfig('expiryWebhookUrl', 'https://legacy.example.com/expiry')

  const requests: CapturedRequest[] = []
  const restoreFetch = installWebhookCapture(requests)

  try {
    notifyLicenseExpiryEvent(expiredTimeCode)
    await waitFor(() => requests.length >= 1)

    assert.equal(requests.length, 1)
    assert.equal(requests[0].url, 'https://legacy.example.com/expiry')
    assert.equal(requests[0].body.code, 'TIME-EXPIRED-NOTIFY-001')
    assert.equal(requests[0].body.event, 'LICENSE_EXPIRED')
    assert.equal(requests[0].body.title === undefined, true)
  } finally {
    restoreFetch()
  }
})

test('发卡成功后触发管理员 webhook 事件与买家邮件', async () => {
  await writeConfig('notifyWebhookUrl', 'https://notify.example.com/hook')
  await writeConfig('notifyEmailSmtpHost', 'smtp.example.com')
  await writeConfig('notifyEmailTo', 'admin@example.com')

  const mails: Array<Record<string, unknown>> = []
  setEmailTransportFactoryForTests(() => ({
    async sendMail(mailOptions) {
      mails.push(mailOptions as Record<string, unknown>)
      return {}
    },
  }))

  const requests: CapturedRequest[] = []
  const restoreFetch = installWebhookCapture(requests)

  try {
    const { product } = await seedOrderFixture()
    const order = await createPendingOrder(product.id, 'buyer@example.com')

    const fulfilled = await fulfillShopOrder({ orderNo: order.orderNo })
    assert.equal(fulfilled.success, true)

    await waitFor(() => requests.length >= 1 && mails.length >= 2)

    assert.equal(requests.length, 1)
    assert.equal(requests[0].body.event, 'SHOP_ORDER_PAID_FULFILLED')
    assert.equal(requests[0].body.data.trigger, 'payment')

    // 管理员通知邮件 + 买家发卡邮件走同一个注入 transport，按收件人区分
    const adminMail = mails.find((mail) => mail.to === 'admin@example.com')
    const buyerMail = mails.find((mail) => mail.to === 'buyer@example.com')
    assert.ok(adminMail)
    assert.ok(buyerMail)
    assert.match(String(buyerMail.subject), /通知测试商品/)
    assert.match(String(buyerMail.text), /1\. /)
  } finally {
    restoreFetch()
  }
})

test('人工确认发卡时事件 trigger 为 admin', async () => {
  await writeConfig('notifyWebhookUrl', 'https://notify.example.com/hook')

  const requests: CapturedRequest[] = []
  const restoreFetch = installWebhookCapture(requests)

  try {
    const { product } = await seedOrderFixture()
    const order = await createPendingOrder(product.id, 'buyer-admin@example.com')

    const fulfilled = await fulfillShopOrder({ orderNo: order.orderNo, adminUsername: 'root' })
    assert.equal(fulfilled.success, true)

    await waitFor(() => requests.length >= 1)

    assert.equal(requests.length, 1)
    assert.equal(requests[0].body.data.trigger, 'admin')
  } finally {
    restoreFetch()
  }
})

test('通知渠道未配置时发卡流程静默跳过', async () => {
  const originalFetch = globalThis.fetch
  let fetchCalled = false
  globalThis.fetch = (async () => {
    fetchCalled = true
    return new Response('{}', { status: 200 })
  }) as typeof fetch

  try {
    const { product } = await seedOrderFixture()
    const order = await createPendingOrder(product.id, 'buyer2@example.com')

    const fulfilled = await fulfillShopOrder({ orderNo: order.orderNo })
    assert.equal(fulfilled.success, true)

    await flushAsyncTasks()
    assert.equal(fetchCalled, false)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('超时清理后触发 webhook 通知（含订单号列表）', async () => {
  await writeConfig('notifyWebhookUrl', 'https://notify.example.com/hook')

  const requests: CapturedRequest[] = []
  const restoreFetch = installWebhookCapture(requests)

  try {
    const { product } = await seedOrderFixture({
      name: '清理通知测试商品',
      licenseMode: 'TIME',
      totalCount: null,
      validDays: 7,
      priceInCents: 300,
    })

    const expired = await createPendingOrder(product.id, 'cleanup@test.com', {
      amountInCents: 300,
      createdAt: new Date(Date.now() - 40 * 60 * 1000),
    })

    const result = await cancelExpiredPendingOrders()
    assert.equal(result.cancelled, 1)

    await waitFor(() => requests.length >= 1)

    assert.equal(requests.length, 1)
    assert.equal(requests[0].body.event, 'SHOP_ORDER_TIMEOUT_CANCELLED')
    assert.deepEqual(requests[0].body.data.orderNos, [expired.orderNo])
    assert.equal(requests[0].body.data.timeoutMinutes, 30)

    const orderStatus = await prisma.shopOrder.findUniqueOrThrow({ where: { id: expired.id } })
    assert.equal(orderStatus.status, 'cancelled')
  } finally {
    restoreFetch()
  }
})

// ---------- 通知投递日志（notification_logs） ----------

test('配置渠道后投递会写入 notification_logs（webhook sent + email skipped 不记录）', async () => {
  await writeConfig('notifyWebhookUrl', 'https://notify.example.com/hook')

  const requests: CapturedRequest[] = []
  const restoreFetch = installWebhookCapture(requests)

  try {
    await runNotificationChannels(buildTestContent())

    assert.equal(requests.length, 1)

    const logs = await prisma.notificationLog.findMany({})
    assert.equal(logs.length, 1)
    assert.equal(logs[0].event, 'SHOP_ORDER_PAID_FULFILLED')
    assert.equal(logs[0].channel, 'webhook')
    assert.equal(logs[0].status, 'sent')
    assert.equal(logs[0].target, 'https://notify.example.com/hook')
    assert.equal(logs[0].relatedId, 'SO-TEST')
    const payload = JSON.parse(logs[0].payload ?? '{}') as { data?: { orderNo?: string } }
    assert.equal(payload.data?.orderNo, 'SO-TEST')
  } finally {
    restoreFetch()
  }
})

test('webhook 投递失败记录 failed 状态', async () => {
  await writeConfig('notifyWebhookUrl', 'https://notify.example.com/hook')

  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => new Response('err', { status: 500 })) as typeof fetch

  try {
    await runNotificationChannels(buildTestContent())

    const logs = await prisma.notificationLog.findMany({ where: { channel: 'webhook' } })
    assert.equal(logs.length, 1)
    assert.equal(logs[0].status, 'failed')
    assert.ok(logs[0].error)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('邮件渠道尝试投递时记录 email 日志；未配置时不记录', async () => {
  // 未配置：runNotificationChannels 全跳过，无日志
  await runNotificationChannels(buildTestContent())
  assert.equal(await prisma.notificationLog.count({}), 0)

  // 配置后：email 日志记录
  await writeConfig('notifyEmailSmtpHost', 'smtp.example.com')
  await writeConfig('notifyEmailTo', 'admin@example.com')
  setEmailTransportFactoryForTests(() => ({
    async sendMail() {
      throw new Error('smtp down')
    },
  }))

  await runNotificationChannels(buildTestContent())

  const logs = await prisma.notificationLog.findMany({ where: { channel: 'email' } })
  assert.equal(logs.length, 1)
  assert.equal(logs[0].status, 'failed')
  assert.equal(logs[0].target, 'admin@example.com')
})

test('超时取消事件日志 relatedId 汇总订单号列表', async () => {
  await writeConfig('notifyWebhookUrl', 'https://notify.example.com/hook')

  const requests: CapturedRequest[] = []
  const restoreFetch = installWebhookCapture(requests)

  try {
    notifyShopOrderTimeoutCancelledEvent({ orderNos: ['SO-A', 'SO-B'], timeoutMinutes: 30 })
    await waitFor(() => requests.length >= 1)

    const logs = await prisma.notificationLog.findMany({ where: { channel: 'webhook' } })
    assert.equal(logs.length, 1)
    assert.equal(logs[0].relatedId, 'SO-A,SO-B')
  } finally {
    restoreFetch()
  }
})
