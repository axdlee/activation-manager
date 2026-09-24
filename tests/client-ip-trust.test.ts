import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CLIENT_IP_FALLBACK,
  CLIENT_IP_UNTRUSTED,
  TRUSTED_PROXY_COUNT_DEFAULT,
  extractClientIp,
  normalizeClientIp,
  resolveTrustedProxyCount,
  type ClientIpRequestLike,
} from '../src/lib/client-ip'
import { authorizeAdminRequest } from '../src/lib/admin-auth-service'

function createRequestLike({
  ip,
  forwardedFor,
  realIp,
  token,
}: {
  ip?: string
  forwardedFor?: string
  realIp?: string
  token?: string
} = {}): ClientIpRequestLike & {
  cookies: { get(name: string): { value: string } | undefined }
} {
  const headerMap = new Map<string, string>()

  if (forwardedFor !== undefined) {
    headerMap.set('x-forwarded-for', forwardedFor)
  }

  if (realIp !== undefined) {
    headerMap.set('x-real-ip', realIp)
  }

  return {
    ip,
    headers: {
      get(name: string) {
        return headerMap.get(name.toLowerCase()) ?? null
      },
    },
    cookies: {
      get(name: string) {
        if (name !== 'auth-token' || !token) {
          return undefined
        }

        return { value: token }
      },
    },
  }
}

test('resolveTrustedProxyCount 未设置/非法时回退默认值，显式 0 生效', () => {
  assert.equal(TRUSTED_PROXY_COUNT_DEFAULT, 1)
  assert.equal(resolveTrustedProxyCount(undefined), 1)
  assert.equal(resolveTrustedProxyCount(''), 1)
  assert.equal(resolveTrustedProxyCount('abc'), 1)
  assert.equal(resolveTrustedProxyCount('-3'), 1)
  assert.equal(resolveTrustedProxyCount('0'), 0)
  assert.equal(resolveTrustedProxyCount('2'), 2)
})

test('extractClientIp 默认（N=1）取 XFF 倒数第一条目，等价直连 socket 注入', () => {
  // Next standalone 在无 XFF 时注入 socket 地址：直连部署单条目即真实地址
  assert.equal(
    extractClientIp(createRequestLike({ forwardedFor: '203.0.113.7' })),
    '203.0.113.7',
  )
  // 多条目：最后一个条目是最内层可信代理追加的真实对端地址
  assert.equal(
    extractClientIp(
      createRequestLike({ forwardedFor: '9.9.9.9, 198.51.100.4' }),
    ),
    '198.51.100.4',
  )
})

test('extractClientIp 按可信层数从右往左取位，客户端伪造条目被跳过', () => {
  // 单层反代追加模式：客户端伪造 9.9.9.9，代理追加真实地址 198.51.100.4
  assert.equal(
    extractClientIp(createRequestLike({ forwardedFor: '9.9.9.9, 198.51.100.4' }), {
      trustedProxyCount: 1,
    }),
    '198.51.100.4',
  )
  // 双层反代：client→P1→P2→本服务，链 = [伪造, 客户端, P1地址]；
  // 默认 N=1 取倒数第一条目（最内层可信代理 P2 追加的 P1 地址）
  assert.equal(
    extractClientIp(
      createRequestLike({ forwardedFor: '9.9.9.9, 198.51.100.4, 10.0.0.1' }),
    ),
    '10.0.0.1',
  )
  assert.equal(
    extractClientIp(
      createRequestLike({ forwardedFor: '9.9.9.9, 198.51.100.4, 10.0.0.1' }),
      { trustedProxyCount: 2 },
    ),
    '198.51.100.4',
  )
})

test('extractClientIp 链路短于可信层数或 N=0 严格模式时返回不可信哨兵', () => {
  // 声明 2 层可信代理但链上只有 1 个条目：伪造/链路异常
  assert.equal(
    extractClientIp(createRequestLike({ forwardedFor: '9.9.9.9' }), {
      trustedProxyCount: 2,
    }),
    CLIENT_IP_UNTRUSTED,
  )
  // N=0：不信任任何客户端可设的头
  assert.equal(
    extractClientIp(createRequestLike({ forwardedFor: '203.0.113.7' }), {
      trustedProxyCount: 0,
    }),
    CLIENT_IP_UNTRUSTED,
  )
})

test('extractClientIp 无任何头时按兜底链路返回，不因缺头暴露哨兵', () => {
  assert.equal(
    extractClientIp(createRequestLike({})),
    CLIENT_IP_FALLBACK,
  )
  // XFF 缺失且 N≥1 时信任最内层代理覆写的 X-Real-IP
  assert.equal(
    extractClientIp(createRequestLike({ realIp: '198.51.100.9' })),
    '198.51.100.9',
  )
  // N=0 时不信任 X-Real-IP
  assert.equal(
    extractClientIp(createRequestLike({ realIp: '198.51.100.9' }), {
      trustedProxyCount: 0,
    }),
    CLIENT_IP_FALLBACK,
  )
  // 平台直接暴露 socket 地址时最可信
  assert.equal(
    extractClientIp(
      createRequestLike({ ip: '::ffff:192.168.1.9', forwardedFor: '6.6.6.6' }),
    ),
    '192.168.1.9',
  )
})

test('normalizeClientIp 折算 IPv4-mapped IPv6 并容忍空白', () => {
  assert.equal(normalizeClientIp('::ffff:192.168.1.9'), '192.168.1.9')
  assert.equal(normalizeClientIp('::FFFF:10.1.2.3'), '10.1.2.3')
  assert.equal(normalizeClientIp('2001:db8::1'), '2001:db8::1')
  assert.equal(normalizeClientIp('  127.0.0.1  '), '127.0.0.1')
})

test('extractClientIp 全链路归一化 IPv4-mapped 条目', () => {
  assert.equal(
    extractClientIp(createRequestLike({ forwardedFor: '::ffff:203.0.113.7' })),
    '203.0.113.7',
  )
})

test('伪造首段 XFF 无法通过白名单（ip_not_allowed），代理追加地址可命中', async () => {
  const dependencies = {
    getAllowedIPs: async () => ['198.51.100.4'],
    verifyToken: async (token: string) => ({ sub: token, isAdmin: true }),
  }

  // 默认 N=1：伪造首段 9.9.9.9 被跳过，但解析出的真实地址不在白名单 → 403
  const denied = await authorizeAdminRequest(
    createRequestLike({ forwardedFor: '9.9.9.9, 203.0.113.7', token: 'valid-token' }),
    { mode: 'protected', nodeEnv: 'production' },
    dependencies,
  )
  assert.equal(denied.success, false)
  assert.equal(denied.code, 'ip_not_allowed')

  // 换上白名单内的真实客户端地址（代理追加段）→ 放行
  const allowed = await authorizeAdminRequest(
    createRequestLike({ forwardedFor: '9.9.9.9, 198.51.100.4', token: 'valid-token' }),
    { mode: 'protected', nodeEnv: 'production' },
    dependencies,
  )
  assert.deepEqual(allowed, { success: true, payload: { sub: 'valid-token', isAdmin: true } })
})

test('不可信哨兵永不命中白名单（含 127.0.0.1 在列时）', async () => {
  const result = await authorizeAdminRequest(
    createRequestLike({ forwardedFor: '9.9.9.9, 8.8.8.8', token: 'valid-token' }),
    { mode: 'protected', nodeEnv: 'production' },
    {
      getAllowedIPs: async () => ['127.0.0.1', '8.8.8.8'],
      verifyToken: async (token: string) => ({ sub: token, isAdmin: true }),
    },
  )

  // N=1 解析到最内层条目 8.8.8.8 → 命中白名单
  assert.deepEqual(result, { success: true, payload: { sub: 'valid-token', isAdmin: true } })

  // N=2 但链上只有 2 条 → 哨兵，即便白名单里有 127.0.0.1 也拒绝
  const sentinel = await authorizeAdminRequest(
    createRequestLike({ forwardedFor: '9.9.9.9, 8.8.8.8', token: 'valid-token' }),
    { mode: 'protected', nodeEnv: 'production' },
    {
      getAllowedIPs: async () => ['127.0.0.1'],
      verifyToken: async (token: string) => ({ sub: token, isAdmin: true }),
    },
  )
  assert.equal(sentinel.success, false)
  assert.equal(sentinel.code, 'ip_not_allowed')
})

test('白名单规则支持 IPv4-mapped IPv6 写法', async () => {
  const result = await authorizeAdminRequest(
    createRequestLike({ forwardedFor: '::ffff:198.51.100.4', token: 'valid-token' }),
    { mode: 'protected', nodeEnv: 'production' },
    {
      getAllowedIPs: async () => ['::ffff:198.51.100.4'],
      verifyToken: async (token: string) => ({ sub: token, isAdmin: true }),
    },
  )

  assert.deepEqual(result, { success: true, payload: { sub: 'valid-token', isAdmin: true } })
})
