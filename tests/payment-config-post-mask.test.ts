/**
 * 批次3（v2.9.0 复查中危）回归：支付配置 POST 响应脱敏。
 *
 * 修复前：GET 返回掩码值，前端原样提交，服务端经
 * mergeMaskedPaymentConfig 还原真实值保存后，把整行配置原样返回 →
 * POST 响应泄露真实密钥（实测 real-webhook-secret 回显）。
 * 修复后：POST 响应统一走 maskConfigPayload（与 GET 同口径）。
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  maskConfigPayload,
  maskPaymentConfigJson,
  mergeMaskedPaymentConfig,
} from '../src/lib/payment-config-mask'

const REAL_CONFIG = JSON.stringify({
  url: 'https://pay.example.com/notify',
  apiKey: 'real-webhook-secret',
  appKey: 'real-app-key-value',
})

test('maskConfigPayload 掩码敏感字段、保留非敏感字段与行字段', () => {
  const masked = maskConfigPayload({
    provider: 'webhook',
    configJson: REAL_CONFIG,
    isEnabled: true,
  })

  assert.equal(masked.provider, 'webhook')
  assert.equal(masked.isEnabled, true)

  const parsed = JSON.parse(masked.configJson) as Record<string, string>
  assert.equal(parsed.url, 'https://pay.example.com/notify', '非敏感字段不脱敏')
  assert.equal(parsed.apiKey, '******', 'apiKey 必须掩码')
  assert.equal(parsed.appKey, '******', 'appKey 必须掩码')
  assert.ok(!masked.configJson.includes('real-webhook-secret'), '响应不得包含真实密钥')
  assert.ok(!masked.configJson.includes('real-app-key-value'), '响应不得包含真实 appKey')
})

test('评审攻击路径闭环：GET 掩码 → 提交还原 → 响应再脱敏', () => {
  // 1. GET 返回掩码
  const masked = maskPaymentConfigJson(REAL_CONFIG)

  // 2. 前端把掩码值原样提交，服务端与存量真实值合并还原
  const restored = mergeMaskedPaymentConfig(masked, REAL_CONFIG)
  assert.equal(JSON.parse(restored).apiKey, 'real-webhook-secret', '掩码提交应还原真实值落库')

  // 3. 保存后的响应必须再次脱敏（修复点）
  const response = maskConfigPayload({ provider: 'webhook', configJson: restored })
  assert.ok(!response.configJson.includes('real-webhook-secret'), 'POST 响应不得回显真实密钥')
  assert.equal(JSON.parse(response.configJson).appKey, '******')
})
