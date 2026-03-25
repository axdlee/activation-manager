import assert from 'node:assert/strict'
import test from 'node:test'

import { MissingRequiredSystemConfigError } from '../src/lib/config-service'
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
} = {}) {
  const headerMap = new Map<string, string>()

  if (forwardedFor) {
    headerMap.set('x-forwarded-for', forwardedFor)
  }

  if (realIp) {
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

test('authorizeAdminRequest 在 public 模式下仅校验白名单，不要求 token', async () => {
  const result = await authorizeAdminRequest(
    createRequestLike({ ip: '127.0.0.1' }),
    { mode: 'public', nodeEnv: 'production' },
    {
      getAllowedIPs: async () => ['127.0.0.1'],
      verifyToken: async () => null,
    },
  )

  assert.deepEqual(result, { success: true })
})

test('authorizeAdminRequest 在 protected 模式下会校验 token 并返回 payload', async () => {
  const result = await authorizeAdminRequest(
    createRequestLike({ ip: '127.0.0.1', token: 'valid-token' }),
    { mode: 'protected', nodeEnv: 'production' },
    {
      getAllowedIPs: async () => ['127.0.0.1'],
      verifyToken: async (token) => ({ sub: token, isAdmin: true }),
    },
  )

  assert.deepEqual(result, {
    success: true,
    payload: { sub: 'valid-token', isAdmin: true },
  })
})

test('authorizeAdminRequest 在 protected 模式下缺少 token 时返回 401', async () => {
  const result = await authorizeAdminRequest(
    createRequestLike({ ip: '127.0.0.1' }),
    { mode: 'protected', nodeEnv: 'production' },
    {
      getAllowedIPs: async () => ['127.0.0.1'],
      verifyToken: async () => null,
    },
  )

  assert.deepEqual(result, {
    success: false,
    code: 'token_missing',
    error: '未提供认证令牌',
    status: 401,
  })
})

test('authorizeAdminRequest 在生产环境下对不在白名单中的 IP 返回 403', async () => {
  const result = await authorizeAdminRequest(
    createRequestLike({ ip: '10.0.0.8', token: 'valid-token' }),
    { mode: 'protected', nodeEnv: 'production' },
    {
      getAllowedIPs: async () => ['127.0.0.1'],
      verifyToken: async () => ({ isAdmin: true }),
    },
  )

  assert.deepEqual(result, {
    success: false,
    code: 'ip_not_allowed',
    error: '访问被拒绝: IP地址不在白名单中',
    status: 403,
  })
})

test('authorizeAdminRequest 遇到关键配置缺失时返回 500 配置错误', async () => {
  const result = await authorizeAdminRequest(
    createRequestLike({ ip: '127.0.0.1', token: 'valid-token' }),
    { mode: 'protected', nodeEnv: 'production' },
    {
      getAllowedIPs: async () => {
        throw new MissingRequiredSystemConfigError('jwtSecret')
      },
      verifyToken: async () => ({ isAdmin: true }),
    },
  )

  assert.deepEqual(result, {
    success: false,
    code: 'config_missing',
    error: '系统配置缺失：jwtSecret 未配置，生产环境禁止回退到仓库默认值',
    status: 500,
  })
})

test('authorizeAdminRequest 遇到 Next Dynamic server usage 哨兵错误时不会打印误导性认证失败日志', async (t) => {
  const originalConsoleError = console.error
  const consoleErrors: unknown[][] = []

  console.error = (...args: unknown[]) => {
    consoleErrors.push(args)
  }

  t.after(() => {
    console.error = originalConsoleError
  })

  const result = await authorizeAdminRequest(
    createRequestLike({ ip: '127.0.0.1', token: 'valid-token' }),
    { mode: 'protected', nodeEnv: 'production' },
    {
      getAllowedIPs: async () => {
        const error = new Error('Dynamic server usage: headers')
        ;(error as Error & { digest?: string }).digest = 'DYNAMIC_SERVER_USAGE'
        throw error
      },
      verifyToken: async () => ({ isAdmin: true }),
    },
  )

  assert.deepEqual(result, {
    success: false,
    code: 'auth_failed',
    error: '认证验证失败',
    status: 500,
  })
  assert.deepEqual(consoleErrors, [])
})
