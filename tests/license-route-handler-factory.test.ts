import assert from 'node:assert/strict'
import test from 'node:test'

import { createLicenseRouteHandler } from '../src/lib/license-route-handlers'

function createJsonRequest(body: Record<string, unknown>) {
  return new Request('http://127.0.0.1:3000/api/license/mock', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

test('createLicenseRouteHandler 会标准化请求体并返回正式响应字段', async () => {
  const calls: Array<{
    client: object
    params: {
      projectKey?: string
      code: string
      machineId: string
      requestId?: string
    }
  }> = []
  const client = { tag: 'mock-client' } as never
  const handler = createLicenseRouteHandler(
    async (receivedClient, params) => {
      calls.push({
        client: receivedClient as object,
        params,
      })

      return {
        success: true,
        message: 'ok',
        status: 200,
        licenseMode: 'COUNT',
        remainingCount: 2,
        isActivated: true,
      }
    },
    {
      errorMessage: '处理失败',
    },
  )

  const response = await handler(
    createJsonRequest({
      project_key: ' browser-plugin ',
      code: ' COUNT-001 ',
      machine_id: ' machine-001 ',
      request_id: ' req-001 ',
    }),
    client,
  )
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.deepEqual(calls, [
    {
      client,
      params: {
        projectKey: 'browser-plugin',
        code: 'COUNT-001',
        machineId: 'machine-001',
        requestId: 'req-001',
      },
    },
  ])
  assert.equal(body.licenseMode, 'COUNT')
  assert.equal(body.license_mode, 'COUNT')
  assert.equal(body.remainingCount, 2)
  assert.equal(body.remaining_count, 2)
  assert.equal(body.isActivated, true)
  assert.equal(body.is_activated, true)
})

test('createLicenseRouteHandler 在 legacyOnly 模式下只返回兼容字段', async () => {
  const handler = createLicenseRouteHandler(
    async () => ({
      success: true,
      message: 'ok',
      status: 200,
      licenseMode: 'COUNT',
      remainingCount: 1,
      isActivated: true,
    }),
    {
      errorMessage: '处理失败',
      legacyOnly: true,
    },
  )

  const response = await handler(
    createJsonRequest({
      code: 'count-001',
      machineId: 'machine-001',
    }),
  )
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.license_mode, 'COUNT')
  assert.equal(body.remaining_count, 1)
  assert.ok(!('licenseMode' in body))
  assert.ok(!('remainingCount' in body))
  assert.ok(!('isActivated' in body))
})

test('createLicenseRouteHandler 在 service 抛出 Error 时会返回统一错误响应', async () => {
  const handler = createLicenseRouteHandler(
    async () => {
      throw new Error('boom')
    },
    {
      errorMessage: '处理失败',
    },
  )

  const response = await handler(
    createJsonRequest({
      code: 'count-001',
      machineId: 'machine-001',
    }),
  )
  const body = await response.json()

  assert.equal(response.status, 400)
  assert.equal(body.success, false)
  assert.equal(body.message, 'boom')
})
