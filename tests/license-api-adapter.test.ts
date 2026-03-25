import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createLicenseJsonResponse,
  normalizeLicenseRequestPayload,
} from '../src/lib/license-api'

test('normalizeLicenseRequestPayload 会统一 camelCase / snake_case 并 trim 请求字段', () => {
  const payload = normalizeLicenseRequestPayload({
    project_key: ' browser-plugin ',
    code: ' COUNT-001 ',
    machine_id: ' machine-001 ',
    requestId: ' req-001 ',
  })

  assert.deepEqual(payload, {
    projectKey: 'browser-plugin',
    code: 'COUNT-001',
    machineId: 'machine-001',
    requestId: 'req-001',
  })
})

test('normalizeLicenseRequestPayload 对缺失或空白字段返回稳定默认值', () => {
  const payload = normalizeLicenseRequestPayload({
    projectKey: '   ',
    code: null,
    machineId: undefined,
    request_id: '   ',
  })

  assert.deepEqual(payload, {
    projectKey: undefined,
    code: '',
    machineId: '',
    requestId: undefined,
  })
})

test('createLicenseJsonResponse 默认返回正式字段与兼容字段并保留状态码', async () => {
  const response = createLicenseJsonResponse({
    success: true,
    message: 'ok',
    status: 200,
    licenseMode: 'COUNT',
    remainingCount: 2,
    isActivated: true,
    valid: true,
    idempotent: false,
  })
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.licenseMode, 'COUNT')
  assert.equal(body.license_mode, 'COUNT')
  assert.equal(body.remainingCount, 2)
  assert.equal(body.remaining_count, 2)
  assert.equal(body.isActivated, true)
  assert.equal(body.is_activated, true)
  assert.equal(body.valid, true)
  assert.equal(body.idempotent, false)
})

test('createLicenseJsonResponse 在 legacyOnly 模式下只返回兼容字段', async () => {
  const response = createLicenseJsonResponse(
    {
      success: true,
      message: 'ok',
      status: 200,
      licenseMode: 'COUNT',
      remainingCount: 1,
      isActivated: true,
    },
    {
      legacyOnly: true,
    },
  )
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.license_mode, 'COUNT')
  assert.equal(body.remaining_count, 1)
  assert.ok(!('licenseMode' in body))
  assert.ok(!('remainingCount' in body))
  assert.ok(!('isActivated' in body))
})
