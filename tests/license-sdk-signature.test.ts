import assert from 'node:assert/strict'
import test from 'node:test'

import { createHmac } from 'node:crypto'

import { createLicenseClient, isLicenseClientError } from '../src/lib/license-sdk'

const SECRET = 'sdk-test-secret'

type MockSignatureVersion = '1' | '2' | '3'

function buildSignedResponse(
  bodyText: string,
  secret: string,
  timestamp: number,
  version: MockSignatureVersion,
  context: { code?: string; machineId?: string } = {},
) {
  const code = (context.code ?? '').trim()
  const machineId = (context.machineId ?? '').trim()

  let message: string
  if (version === '1') {
    message = bodyText
  } else if (version === '3') {
    message = `${timestamp}.${code}|${machineId}.${bodyText}`
  } else {
    message = `${timestamp}.${bodyText}`
  }

  return {
    signature: createHmac('sha256', secret).update(message).digest('hex'),
    timestamp: String(timestamp),
    version,
  }
}

function createFetchMock(options: {
  body?: unknown
  status?: number
  secret?: string
  sign?: boolean
  timestampOffsetMs?: number
  version?: MockSignatureVersion
  /** mock 服务端使用的签名上下文（默认取请求里的 code/machineId，模拟正确实现） */
  signContext?: { code?: string; machineId?: string } | null
}) {
  const {
    body = { success: true, message: 'ok' },
    status = 200,
    secret = SECRET,
    sign = true,
    timestampOffsetMs = 0,
    version = '2',
    signContext,
  } = options

  const bodyText = JSON.stringify(body ?? { success: true, message: 'ok' })

  return async (_requestUrl: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (sign && secret) {
      let context: { code?: string; machineId?: string } = {}
      if (signContext) {
        // 显式指定签名上下文（模拟错误实现 / 转发场景）
        context = signContext
      } else {
        // 模拟真实服务端：v3 按请求里的 code/machineId 签名
        const requestBody = JSON.parse(String(init?.body ?? '{}')) as {
          code?: string
          machineId?: string
        }
        context = { code: requestBody.code, machineId: requestBody.machineId }
      }
      const { signature, timestamp } = buildSignedResponse(
        bodyText,
        secret,
        Date.now() + timestampOffsetMs,
        version,
        context,
      )
      headers['x-license-signature'] = signature
      headers['x-license-timestamp'] = timestamp
      headers['x-license-signature-version'] = version
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

test('SDK 对 v1 签名响应（声明版本 1）正常验签（过渡兼容）', async () => {
  const client = createLicenseClient({
    baseUrl: 'http://127.0.0.1:3000',
    fetch: createFetchMock({ body: { success: true, message: 'ok' }, version: '1' }) as unknown as typeof fetch,
    responseSecret: SECRET,
  })

  const result = await client.status({
    projectKey: 'demo',
    code: 'CODE-001',
    machineId: 'machine-001',
  })

  assert.equal(result.success, true)
})

test('SDK 对 v3 签名响应（绑定 code+machineId）正常验签', async () => {
  const client = createLicenseClient({
    baseUrl: 'http://127.0.0.1:3000',
    fetch: createFetchMock({ body: { success: true, message: 'ok' }, version: '3' }) as unknown as typeof fetch,
    responseSecret: SECRET,
  })

  const result = await client.activate({
    projectKey: 'demo',
    code: 'CODE-001',
    machineId: 'machine-001',
  })

  assert.equal(result.success, true)
})

test('SDK 对 v3 签名响应拒绝错配的上下文（响应转发防护）', async () => {
  // mock 服务端用别的 code/machineId 签名——模拟把 A 授权的响应转发给 B 使用
  const client = createLicenseClient({
    baseUrl: 'http://127.0.0.1:3000',
    fetch: createFetchMock({
      body: { success: true, message: 'ok' },
      version: '3',
      signContext: { code: 'CODE-OTHER', machineId: 'machine-other' },
    }) as unknown as typeof fetch,
    responseSecret: SECRET,
  })

  await assert.rejects(
    () => client.activate({ projectKey: 'demo', code: 'CODE-001', machineId: 'machine-001' }),
    (error: unknown) => {
      assert.equal((error as { code?: string }).code, 'SIGNATURE_INVALID')
      return true
    },
  )
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

test('SDK createShopOrder 创建订单并返回订单号', async () => {
  const mockFetch = async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body))
    assert.equal(body.productId, 1)
    return new Response(
      JSON.stringify({
        success: true,
        order: {
          orderNo: 'SOSDK0001',
          productName: '月卡',
          amountInCents: 990,
          status: 'pending',
          provider: 'manual',
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  }

  const client = createLicenseClient({
    baseUrl: 'http://127.0.0.1:3000',
    fetch: mockFetch as unknown as typeof fetch,
  })

  const result = await client.createShopOrder({
    productId: 1,
    providerId: 'manual',
    contactEmail: 'sdk@example.com',
  })

  assert.equal(result.success, true)
  assert.equal(result.order?.orderNo, 'SOSDK0001')
})

test('SDK queryShopOrder 查询已发卡密', async () => {
  const mockFetch = async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body))
    assert.equal(body.orderNo, 'SOSDK0001')
    return new Response(
      JSON.stringify({
        success: true,
        codes: [{ id: 1, code: 'AABBCCDDEEFF0011', cardType: '月卡' }],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  }

  const client = createLicenseClient({
    baseUrl: 'http://127.0.0.1:3000',
    fetch: mockFetch as unknown as typeof fetch,
  })

  const result = await client.queryShopOrder({
    orderNo: 'SOSDK0001',
    contactEmail: 'sdk@example.com',
  })

  assert.equal(result.success, true)
  assert.equal(result.codes?.[0]?.code, 'AABBCCDDEEFF0011')
})

test('SDK createShopOrder 网络错误时抛出可辨识异常', async () => {
  const client = createLicenseClient({
    baseUrl: 'http://127.0.0.1:3000',
    fetch: (async () => {
      throw new Error('network down')
    }) as unknown as typeof fetch,
  })

  await assert.rejects(
    () => client.createShopOrder({ productId: 1, providerId: 'manual' }),
    /network down/,
  )
})
