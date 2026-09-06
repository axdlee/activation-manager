import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildTestSignature,
  signLicenseResponseBody,
  verifyLicenseResponseSignature,
} from '../src/lib/license-response-signature'

const SECRET = 'test-response-secret-123'
const BODY = '{"success":true,"message":"激活码激活成功"}'

test('signLicenseResponseBody 生成确定性的 HMAC-SHA256 十六进制签名', () => {
  const sig1 = signLicenseResponseBody(BODY, SECRET)
  const sig2 = signLicenseResponseBody(BODY, SECRET)

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
