import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createLicenseClient,
  isLicenseClientError,
  normalizeLicenseApiResponse,
} from '../src/lib/license-sdk'

test('normalizeLicenseApiResponse 会将 snake_case 响应归一化为 camelCase', () => {
  const response = normalizeLicenseApiResponse(
    {
      success: true,
      message: '获取激活码状态成功',
      license_mode: 'COUNT',
      expires_at: null,
      remaining_count: 2,
      is_activated: true,
      valid: true,
      idempotent: false,
    },
    200,
  )

  assert.deepEqual(response, {
    success: true,
    message: '获取激活码状态成功',
    status: 200,
    licenseMode: 'COUNT',
    expiresAt: null,
    remainingCount: 2,
    isActivated: true,
    valid: true,
    idempotent: false,
  })
})

test('createLicenseClient.activate 会请求正式激活接口并自动附带默认 projectKey', async () => {
  let capturedUrl = ''
  let capturedInit: RequestInit | undefined

  const client = createLicenseClient({
    baseUrl: 'https://license.example.com/',
    projectKey: 'browser-plugin',
    fetch: async (input, init) => {
      capturedUrl = String(input)
      capturedInit = init

      return new Response(
        JSON.stringify({
          success: true,
          message: '激活码激活成功',
          licenseMode: 'COUNT',
          remainingCount: 2,
          isActivated: true,
          valid: true,
          idempotent: null,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    },
  })

  const result = await client.activate({
    code: 'ABC123',
    machineId: 'machine-001',
  })

  assert.equal(capturedUrl, 'https://license.example.com/api/license/activate')
  assert.equal(capturedInit?.method, 'POST')
  assert.equal(new Headers(capturedInit?.headers).get('Content-Type'), 'application/json')
  assert.deepEqual(JSON.parse(String(capturedInit?.body)), {
    projectKey: 'browser-plugin',
    code: 'ABC123',
    machineId: 'machine-001',
  })
  assert.deepEqual(result, {
    success: true,
    message: '激活码激活成功',
    status: 200,
    licenseMode: 'COUNT',
    expiresAt: null,
    remainingCount: 2,
    isActivated: true,
    valid: true,
    idempotent: null,
  })
})

test('createLicenseClient.consume 允许覆盖默认 projectKey 并携带 requestId', async () => {
  let requestBody: Record<string, unknown> | null = null

  const client = createLicenseClient({
    baseUrl: 'https://license.example.com',
    projectKey: 'default-project',
    fetch: async (_input, init) => {
      requestBody = JSON.parse(String(init?.body))

      return new Response(
        JSON.stringify({
          success: true,
          message: '请求已处理',
          license_mode: 'COUNT',
          remaining_count: 1,
          is_activated: true,
          valid: true,
          idempotent: true,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    },
  })

  const result = await client.consume({
    projectKey: 'browser-plugin',
    code: 'XYZ789',
    machineId: 'machine-002',
    requestId: 'req-001',
  })

  assert.deepEqual(requestBody, {
    projectKey: 'browser-plugin',
    code: 'XYZ789',
    machineId: 'machine-002',
    requestId: 'req-001',
  })
  assert.equal(result.idempotent, true)
  assert.equal(result.remainingCount, 1)
})

test('createLicenseClient 会在请求超时时抛出统一的 SDK 错误', async () => {
  const client = createLicenseClient({
    baseUrl: 'https://license.example.com',
    timeoutMs: 10,
    fetch: async (_input, init) =>
      new Promise((_resolve, reject) => {
        const signal = init?.signal

        if (!signal) {
          reject(new Error('missing signal'))
          return
        }

        if (signal.aborted) {
          reject(new DOMException('Aborted', 'AbortError'))
          return
        }

        signal.addEventListener(
          'abort',
          () => reject(new DOMException('Aborted', 'AbortError')),
          { once: true },
        )
      }),
  })

  await assert.rejects(
    () =>
      client.activate({
        code: 'TIMEOUT-001',
        machineId: 'machine-timeout-001',
      }),
    (error: unknown) => {
      assert.equal(isLicenseClientError(error), true)
      assert.equal(error instanceof Error ? error.name : '', 'LicenseClientError')
      assert.equal((error as { code?: string }).code, 'TIMEOUT')
      assert.equal((error as { path?: string }).path, '/api/license/activate')
      assert.equal((error as { attemptCount?: number }).attemptCount, 1)
      return true
    },
  )
})

test('createLicenseClient.activate 会按配置重试瞬时网络错误', async () => {
  let attempts = 0

  const client = createLicenseClient({
    baseUrl: 'https://license.example.com',
    maxRetries: 1,
    retryDelayMs: 0,
    fetch: async () => {
      attempts += 1

      if (attempts === 1) {
        throw new Error('socket hang up')
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: '激活码激活成功',
          licenseMode: 'COUNT',
          remainingCount: 3,
          isActivated: true,
          valid: true,
          idempotent: null,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    },
  })

  const result = await client.activate({
    code: 'RETRY-001',
    machineId: 'machine-retry-001',
  })

  assert.equal(attempts, 2)
  assert.equal(result.success, true)
  assert.equal(result.remainingCount, 3)
})

test('createLicenseClient.consume 在未提供 requestId 时不会自动重试，避免重复扣次风险', async () => {
  let attempts = 0

  const client = createLicenseClient({
    baseUrl: 'https://license.example.com',
    maxRetries: 2,
    retryDelayMs: 0,
    fetch: async () => {
      attempts += 1
      throw new Error('temporary network error')
    },
  })

  await assert.rejects(
    () =>
      client.consume({
        code: 'CONSUME-001',
        machineId: 'machine-consume-001',
      }),
    (error: unknown) => {
      assert.equal(isLicenseClientError(error), true)
      assert.equal((error as { code?: string }).code, 'NETWORK_ERROR')
      assert.equal((error as { attemptCount?: number }).attemptCount, 1)
      return true
    },
  )

  assert.equal(attempts, 1)
})

test('createLicenseClient.consume 在提供 requestId 时允许重试瞬时网络错误', async () => {
  let attempts = 0

  const client = createLicenseClient({
    baseUrl: 'https://license.example.com',
    maxRetries: 1,
    retryDelayMs: 0,
    fetch: async () => {
      attempts += 1

      if (attempts === 1) {
        throw new Error('temporary network error')
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: '请求已处理',
          licenseMode: 'COUNT',
          remainingCount: 1,
          isActivated: true,
          valid: true,
          idempotent: false,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    },
  })

  const result = await client.consume({
    code: 'CONSUME-002',
    machineId: 'machine-consume-002',
    requestId: 'consume-retry-001',
  })

  assert.equal(attempts, 2)
  assert.equal(result.success, true)
  assert.equal(result.idempotent, false)
})

test('createLicenseClient.activate 成功后会调用 onSuccess hook 并传出请求上下文', async () => {
  const events: Array<Record<string, unknown>> = []

  const options = {
    baseUrl: 'https://license.example.com',
    projectKey: 'browser-plugin',
    onSuccess: (event: Record<string, unknown>) => {
      events.push(event)
    },
    fetch: async () =>
      new Response(
        JSON.stringify({
          success: true,
          message: '激活码激活成功',
          licenseMode: 'COUNT',
          remainingCount: 5,
          isActivated: true,
          valid: true,
          idempotent: null,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
  }

  const client = createLicenseClient(options)

  const result = await client.activate({
    code: 'HOOK-SUCCESS-001',
    machineId: 'machine-hook-success-001',
  })

  assert.equal(events.length, 1)
  assert.deepEqual(events[0], {
    path: '/api/license/activate',
    attemptCount: 1,
    totalAttempts: 1,
    requestBody: {
      projectKey: 'browser-plugin',
      code: 'HOOK-SUCCESS-001',
      machineId: 'machine-hook-success-001',
    },
    response: result,
  })
})

test('createLicenseClient.activate 重试前会调用 onRetry hook', async () => {
  let attempts = 0
  const events: Array<Record<string, unknown>> = []

  const options = {
    baseUrl: 'https://license.example.com',
    maxRetries: 1,
    retryDelayMs: 0,
    onRetry: (event: Record<string, unknown>) => {
      events.push(event)
    },
    fetch: async () => {
      attempts += 1

      if (attempts === 1) {
        throw new Error('socket hang up')
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: '激活码激活成功',
          licenseMode: 'COUNT',
          remainingCount: 4,
          isActivated: true,
          valid: true,
          idempotent: null,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    },
  }

  const client = createLicenseClient(options)

  await client.activate({
    code: 'HOOK-RETRY-001',
    machineId: 'machine-hook-retry-001',
  })

  assert.equal(events.length, 1)
  assert.equal(events[0]?.path, '/api/license/activate')
  assert.equal(events[0]?.attemptCount, 1)
  assert.equal(events[0]?.nextAttemptCount, 2)
  assert.equal(events[0]?.totalAttempts, 2)
  assert.equal((events[0]?.error as { code?: string }).code, 'NETWORK_ERROR')
})

test('createLicenseClient.activate 最终失败时会调用 onError hook', async () => {
  const events: Array<Record<string, unknown>> = []

  const options = {
    baseUrl: 'https://license.example.com',
    maxRetries: 1,
    retryDelayMs: 0,
    onError: (event: Record<string, unknown>) => {
      events.push(event)
    },
    fetch: async () => {
      throw new Error('temporary network error')
    },
  }

  const client = createLicenseClient(options)

  await assert.rejects(() =>
    client.activate({
      code: 'HOOK-ERROR-001',
      machineId: 'machine-hook-error-001',
    }),
  )

  assert.equal(events.length, 1)
  assert.equal(events[0]?.path, '/api/license/activate')
  assert.equal(events[0]?.attemptCount, 2)
  assert.equal(events[0]?.totalAttempts, 2)
  assert.equal((events[0]?.error as { code?: string }).code, 'NETWORK_ERROR')
})

test('createLicenseClient.consume 未提供 requestId 时不会触发 onRetry hook', async () => {
  let onRetryCalled = false

  const options = {
    baseUrl: 'https://license.example.com',
    maxRetries: 2,
    retryDelayMs: 0,
    onRetry: () => {
      onRetryCalled = true
    },
    fetch: async () => {
      throw new Error('temporary network error')
    },
  }

  const client = createLicenseClient(options)

  await assert.rejects(() =>
    client.consume({
      code: 'HOOK-CONSUME-001',
      machineId: 'machine-hook-consume-001',
    }),
  )

  assert.equal(onRetryCalled, false)
})
