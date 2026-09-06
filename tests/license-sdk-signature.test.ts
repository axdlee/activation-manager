import assert from 'node:assert/strict'
import test from 'node:test'

import { createHmac } from 'node:crypto'

import { createLicenseClient, isLicenseClientError } from '../src/lib/license-sdk'

const SECRET = 'sdk-test-secret'

function signBody(body: string, secret: string, timestamp: number) {
  const signature = createHmac('sha256', secret).update(body).digest('hex')
  return {
    signature,
    timestamp: String(timestamp),
  }
}

function createFetchMock(options: {
  body?: unknown
  status?: number
  secret?: string
  sign?: boolean
  timestampOffsetMs?: number
}) {
  const {
    body = { success: true, message: 'ok' },
    status = 200,
    secret = SECRET,
    sign = true,
    timestampOffsetMs = 0,
  } = options

  const bodyText = JSON.stringify(body ?? { success: true, message: 'ok' })

  return async () => {
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (sign && secret) {
      const { signature, timestamp } = signBody(bodyText, secret, Date.now() + timestampOffsetMs)
      headers['x-license-signature'] = signature
      headers['x-license-timestamp'] = timestamp
    }

    return new Response(bodyText, { status, headers })
  }
}

test('SDK 配置 responseSecret 后对合法签名响应正常返回', async () => {
  const client = createLicenseClient({
    baseUrl: 'http://127.0.0.1:3000',
    fetch: createFetchMock({ body: { success: true, message: 'ok' } }) as unknown as typeof fetch,
    responseSecret: SECRET,
  })

  const result = await client.activate({
    projectKey: 'demo',
    code: 'CODE-001',
    machineId: 'machine-001',
  })

  assert.equal(result.success, true)
})

test('SDK 对篡改响应抛 SIGNATURE_INVALID', async () => {
  const mock = createFetchMock({ sign: false }) as unknown as typeof fetch

  const client = createLicenseClient({
    baseUrl: 'http://127.0.0.1:3000',
    fetch: mock,
    responseSecret: SECRET,
  })

  await assert.rejects(
    () => client.status({ projectKey: 'demo', code: 'CODE-001', machineId: 'm' }),
    (error: unknown) => {
      assert.equal(isLicenseClientError(error), true)
      assert.equal((error as { code?: string }).code, 'SIGNATURE_INVALID')
      return true
    },
  )
})

test('SDK 对过期时间戳响应抛 SIGNATURE_INVALID（防重放）', async () => {
  const client = createLicenseClient({
    baseUrl: 'http://127.0.0.1:3000',
    fetch: createFetchMock({ body: { success: true, message: 'ok' }, timestampOffsetMs: -10 * 60 * 1000 }) as unknown as typeof fetch,
    responseSecret: SECRET,
  })

  await assert.rejects(
    () => client.status({ projectKey: 'demo', code: 'CODE-001', machineId: 'm' }),
    (error: unknown) => {
      assert.equal((error as { code?: string }).code, 'SIGNATURE_INVALID')
      return true
    },
  )
})

test('SDK 未配置 responseSecret 时对未签名响应正常返回（向后兼容）', async () => {
  const client = createLicenseClient({
    baseUrl: 'http://127.0.0.1:3000',
    fetch: createFetchMock({ body: { success: true, message: 'ok' }, sign: false }) as unknown as typeof fetch,
  })

  const result = await client.status({
    projectKey: 'demo',
    code: 'CODE-001',
    machineId: 'm',
  })

  assert.equal(result.success, true)
})
