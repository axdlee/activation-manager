import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildTestSignature,
  signLicenseResponseBody,
  verifyLicenseResponseSignature,
} from '../src/lib/license-response-signature'

const SECRET = 'test-response-secret-123'
const BODY = '{"success":true,"message":"激活码激活成功"}'

test('signLicenseResponseBody 生成确定性的 HMAC-SHA256 十六进制签名（v2：时间戳参与签名）', () => {
  const sig1 = signLicenseResponseBody(BODY, SECRET, '1700000000000')
  const sig2 = signLicenseResponseBody(BODY, SECRET, '1700000000000')

  assert.match(sig1, /^[0-9a-f]{64}$/)
  assert.equal(sig1, sig2)
})

test('verifyLicenseResponseSignature 对合法签名返回 true', () => {
  const now = Date.now()
  const { signature, timestamp } = buildTestSignature(BODY, SECRET, now)

  assert.equal(
    verifyLicenseResponseSignature({ body: BODY, signature, timestamp, secret: SECRET, now }),
    true,
  )
})

test('verifyLicenseResponseSignature 对篡改后的 body 返回 false', () => {
  const now = Date.now()
  const { signature, timestamp } = buildTestSignature(BODY, SECRET, now)

  assert.equal(
    verifyLicenseResponseSignature({
      body: '{"success":false,"message":"篡改"}',
      signature,
      timestamp,
      secret: SECRET,
      now,
    }),
    false,
  )
})

test('verifyLicenseResponseSignature 对错误密钥返回 false', () => {
  const now = Date.now()
  const { signature, timestamp } = buildTestSignature(BODY, SECRET, now)

  assert.equal(
    verifyLicenseResponseSignature({
      body: BODY,
      signature,
      timestamp,
      secret: 'wrong-secret',
      now,
    }),
    false,
  )
})

test('verifyLicenseResponseSignature 对过期时间戳返回 false（防重放）', () => {
  const now = Date.now()
  const { signature, timestamp } = buildTestSignature(BODY, SECRET, now - 10 * 60 * 1000)

  assert.equal(
    verifyLicenseResponseSignature({ body: BODY, signature, timestamp, secret: SECRET, now }),
    false,
  )
})

test('verifyLicenseResponseSignature 缺少签名或时间戳时返回 false', () => {
  assert.equal(
    verifyLicenseResponseSignature({
      body: BODY,
      signature: '',
      timestamp: String(Date.now()),
      secret: SECRET,
    }),
    false,
  )
  assert.equal(
    verifyLicenseResponseSignature({
      body: BODY,
      signature: 'abc',
      timestamp: '',
      secret: SECRET,
    }),
    false,
  )
})

test('verifyLicenseResponseSignature 时间戳格式非法时返回 false', () => {
  const now = Date.now()
  const { signature } = buildTestSignature(BODY, SECRET, now)

  assert.equal(
    verifyLicenseResponseSignature({
      body: BODY,
      signature,
      timestamp: 'not-a-number',
      secret: SECRET,
      now,
    }),
    false,
  )
})

test('signLicenseResponseBody v4 将 code|machineId|requestId 绑定进 HMAC 输入', () => {
  const context = { code: 'CODE-001', machineId: 'machine-001', requestId: 'req-001' }
  const sigA = signLicenseResponseBody(BODY, SECRET, '1700000000000', { version: '4', context })
  const sigB = signLicenseResponseBody(BODY, SECRET, '1700000000000', {
    version: '4',
    context: { code: 'CODE-002', machineId: 'machine-001', requestId: 'req-001' },
  })
  const sigC = signLicenseResponseBody(BODY, SECRET, '1700000000000', {
    version: '4',
    context: { code: 'CODE-001', machineId: 'machine-001', requestId: 'req-002' },
  })

  // 不同 code 或不同 requestId 产出不同签名：A 授权的响应无法转发给 B 的 code/machineId，
  // 旧响应也无法在同码同机下重放（requestId 不同）
  assert.notEqual(sigA, sigB)
  assert.notEqual(sigA, sigC)
  assert.equal(
    sigA,
    signLicenseResponseBody(BODY, SECRET, '1700000000000', { version: '4', context }),
  )
})

test('verifyLicenseResponseSignature v4 版本协商往返成立（含 requestId 防重放）', () => {
  const now = Date.now()
  const context = { code: 'CODE-001', machineId: 'machine-001', requestId: 'req-001' }
  const { signature, timestamp } = buildTestSignature(BODY, SECRET, now, { version: '4', context })

  assert.equal(
    verifyLicenseResponseSignature({ body: BODY, signature, timestamp, secret: SECRET, version: '4', context, now }),
    true,
  )
  // 上下文不匹配 → false（转发防护）
  assert.equal(
    verifyLicenseResponseSignature({
      body: BODY,
      signature,
      timestamp,
      secret: SECRET,
      version: '4',
      context: { code: 'CODE-999', machineId: 'machine-001', requestId: 'req-001' },
      now,
    }),
    false,
  )
  // requestId 不匹配 → false（同码同机旧响应重放防护）
  assert.equal(
    verifyLicenseResponseSignature({
      body: BODY,
      signature,
      timestamp,
      secret: SECRET,
      version: '4',
      context: { code: 'CODE-001', machineId: 'machine-001', requestId: 'req-002' },
      now,
    }),
    false,
  )
})

test('resolveResponseSignatureVersion：2/3/4 白名单，v1 已下线回落 2，未声明与非法值回落 2', async () => {
  const { resolveResponseSignatureVersion } = await import('../src/lib/license-response-signature')

  assert.equal(resolveResponseSignatureVersion('2'), '2')
  assert.equal(resolveResponseSignatureVersion('3'), '3')
  assert.equal(resolveResponseSignatureVersion('4'), '4')
  // v1 下线：声明 1 的客户端回落 v2（v1 客户端本就因 v2.9.0 断签）
  assert.equal(resolveResponseSignatureVersion('1'), '2')
  assert.equal(resolveResponseSignatureVersion(null), '2')
  assert.equal(resolveResponseSignatureVersion(undefined), '2')
  assert.equal(resolveResponseSignatureVersion('9'), '2')
  assert.equal(resolveResponseSignatureVersion('drop-table'), '2')
})

test('v2/v3/v4 签名互不兼容（版本头必须与算法一致）', () => {
  const timestamp = '1700000000000'
  const v2 = signLicenseResponseBody(BODY, SECRET, timestamp, { version: '2' })
  const v3 = signLicenseResponseBody(BODY, SECRET, timestamp, {
    version: '3',
    context: { code: 'C', machineId: 'M' },
  })
  const v4 = signLicenseResponseBody(BODY, SECRET, timestamp, {
    version: '4',
    context: { code: 'C', machineId: 'M', requestId: 'R' },
  })

  assert.notEqual(v2, v3)
  assert.notEqual(v3, v4)
  assert.notEqual(v2, v4)
})
