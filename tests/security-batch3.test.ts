/**
 * 批次3 小项单测：
 * 1. renderSmsBody JSON 模板转义（内容含引号/换行不破坏报文）
 * 2. authorizeAdminRequest 令牌版本校验（改密后旧令牌 401）
 * 3. 限流表按时间清理触发逻辑（每小时一次、只删过期行）
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { renderSmsBody } from '../src/lib/notification-sms'
import { authorizeAdminRequest } from '../src/lib/admin-auth-service'
import { maybeSweepAdminLoginRateLimitStore } from '../src/lib/admin-login-route-handler'

test('renderSmsBody 纯文本模板保持原行为', () => {
  assert.equal(
    renderSmsBody('您好 {phone}，您的卡密：{content}', '13800000000', 'ABCD-1234'),
    '您好 13800000000，您的卡密：ABCD-1234',
  )
})

test('renderSmsBody JSON 模板转义内容中的引号与换行', () => {
  const template = '{"phone":"{phone}","text":"{content}"}'
  const rendered = renderSmsBody(template, '13800000000', '密码是 "a,b"\n第二行')

  // 输出必须是合法 JSON 且字段值完整
  const parsed = JSON.parse(rendered) as { phone: string; text: string }
  assert.equal(parsed.phone, '13800000000')
  assert.equal(parsed.text, '密码是 "a,b"\n第二行')
})

test('renderSmsBody 嵌套 JSON 对象同样安全', () => {
  const template = '{"msg":{"body":"{content}","sig":"x"}}'
  const parsed = JSON.parse(renderSmsBody(template, '138', 'line1\\line2\r\nend')) as {
    msg: { body: string; sig: string }
  }
  assert.equal(parsed.msg.body, 'line1\\line2\r\nend')
  assert.equal(parsed.msg.sig, 'x')
})

function createAuthRequestLike(token?: string) {
  return {
    ip: '127.0.0.1',
    headers: { get: () => null },
    cookies: { get: () => (token ? { value: token } : undefined) },
  }
}

test('令牌版本不匹配的旧令牌被拒绝', async () => {
  const result = await authorizeAdminRequest(
    createAuthRequestLike('old-token'),
    { mode: 'protected', nodeEnv: 'production' },
    {
      getAllowedIPs: async () => ['127.0.0.1'],
      verifyToken: async () => ({ username: 'admin', isAdmin: true, tokenVersion: 0 }),
      getTokenVersion: async () => 1,
    },
  )

  assert.equal(result.success, false)
  if (!result.success) {
    assert.equal(result.code, 'token_invalid')
    assert.equal(result.status, 401)
  }
})

test('令牌版本匹配则放行', async () => {
  const result = await authorizeAdminRequest(
    createAuthRequestLike('new-token'),
    { mode: 'protected', nodeEnv: 'production' },
    {
      getAllowedIPs: async () => ['127.0.0.1'],
      verifyToken: async () => ({ username: 'admin', isAdmin: true, tokenVersion: 3 }),
      getTokenVersion: async () => 3,
    },
  )

  assert.equal(result.success, true)
})

test('账户不存在（版本查询 null）跳过版本校验，兼容 dev 兜底令牌', async () => {
  const result = await authorizeAdminRequest(
    createAuthRequestLike('dev-token'),
    { mode: 'protected', nodeEnv: 'development' },
    {
      getAllowedIPs: async () => [],
      verifyToken: async () => ({ username: 'admin', isAdmin: true }),
      getTokenVersion: async () => null,
    },
  )

  assert.equal(result.success, true)
})

test('限流表清理：首次触发删除过期行，一小时内不重复触发', async () => {
  const calls: Array<Record<string, unknown>> = []
  const client = {
    adminLoginRateLimitState: {
      deleteMany: async (args: Record<string, unknown>) => {
        calls.push(args)
        return { count: 0 }
      },
    },
  }

  const t0 = 1_000_000_000
  maybeSweepAdminLoginRateLimitStore(t0, client as never)
  // 一小时内再次登录：不触发
  maybeSweepAdminLoginRateLimitStore(t0 + 30 * 60 * 1000, client as never)
  assert.equal(calls.length, 1)

  // 超过一小时：再次触发，且只删 24 小时未更新的行
  maybeSweepAdminLoginRateLimitStore(t0 + 61 * 60 * 1000, client as never)
  assert.equal(calls.length, 2)

  const where = (calls[0] as { where: { updatedAt: { lt: Date } } }).where
  assert.equal(where.updatedAt.lt.getTime(), t0 - 24 * 60 * 60 * 1000)
})
