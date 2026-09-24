/**
 * 批次2 脱敏纯函数测试：payment-config-mask.ts
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  isSensitivePaymentConfigKey,
  maskActivationCodeForLog,
  maskPaymentConfigJson,
  mergeMaskedPaymentConfig,
} from '../src/lib/payment-config-mask'

test('maskActivationCodeForLog 保留头尾并遮蔽中段', () => {
  assert.equal(maskActivationCodeForLog('ABCDEF1234567890'), 'ABCD****90')
  assert.equal(maskActivationCodeForLog('SHORT1'), '****') // 6 位 → 全遮
  assert.equal(maskActivationCodeForLog('AB'), '****')
  assert.equal(maskActivationCodeForLog('  '), '****')
})

test('isSensitivePaymentConfigKey 覆盖常见密钥字段名', () => {
  assert.equal(isSensitivePaymentConfigKey('key'), true)
  assert.equal(isSensitivePaymentConfigKey('secret'), true)
  assert.equal(isSensitivePaymentConfigKey('appSecret'), true)
  assert.equal(isSensitivePaymentConfigKey('privateKey'), true)
  assert.equal(isSensitivePaymentConfigKey('apiKey'), true)
  assert.equal(isSensitivePaymentConfigKey('url'), false)
  assert.equal(isSensitivePaymentConfigKey('gateway'), false)
  assert.equal(isSensitivePaymentConfigKey('pid'), false)
})

test('maskPaymentConfigJson 只掩码敏感字段', () => {
  const masked = maskPaymentConfigJson(
    JSON.stringify({ gateway: 'https://pay.x', pid: '1001', key: 'real-key' }),
  )
  const parsed = JSON.parse(masked) as Record<string, string>
  assert.equal(parsed.gateway, 'https://pay.x')
  assert.equal(parsed.pid, '1001')
  assert.equal(parsed.key, '******')
})

test('maskPaymentConfigJson 非法 JSON 原样返回', () => {
  assert.equal(maskPaymentConfigJson('not-json'), 'not-json')
})

test('mergeMaskedPaymentConfig 掩码占位还原存量值', () => {
  const existing = JSON.stringify({ gateway: 'https://pay.x', pid: '1001', key: 'real-key' })
  const merged = mergeMaskedPaymentConfig(
    JSON.stringify({ gateway: 'https://pay.y', pid: '1001', key: '******' }),
    existing,
  )
  const parsed = JSON.parse(merged) as Record<string, string>
  assert.equal(parsed.gateway, 'https://pay.y')
  assert.equal(parsed.pid, '1001')
  assert.equal(parsed.key, 'real-key')
})

test('mergeMaskedPaymentConfig 存量无值时丢弃未知占位（交回闸门按缺失处理）', () => {
  const merged = mergeMaskedPaymentConfig(
    JSON.stringify({ secret: '******', url: 'https://x' }),
    JSON.stringify({ url: 'https://old' }),
  )
  const parsed = JSON.parse(merged) as Record<string, string>
  assert.equal(parsed.secret, undefined)
  assert.equal(parsed.url, 'https://x')
})
