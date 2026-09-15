import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getLicenseApiMetrics,
  getLicenseApiMetricsSummary,
  recordLicenseApiRequest,
  resetLicenseApiMetrics,
} from '../src/lib/license-api-metrics'

test.beforeEach(() => {
  resetLicenseApiMetrics()
})

test('recordLicenseApiRequest 按路径聚合成功请求', () => {
  recordLicenseApiRequest({ pathname: '/api/license/activate', success: true, durationMs: 10 })
  recordLicenseApiRequest({ pathname: '/api/license/activate', success: true, durationMs: 30 })
  recordLicenseApiRequest({ pathname: '/api/license/consume', success: true, durationMs: 20 })

  const metrics = getLicenseApiMetrics()
  const activate = metrics.find((m) => m.path === 'activate')
  const consume = metrics.find((m) => m.path === 'consume')

  assert.equal(activate?.total, 2)
  assert.equal(activate?.success, 2)
  assert.equal(activate?.avgDurationMs, 20) // (10+30)/2
  assert.equal(consume?.total, 1)
})

test('recordLicenseApiRequest 区分失败与限流', () => {
  recordLicenseApiRequest({ pathname: '/api/license/status', success: false, durationMs: 5 })
  recordLicenseApiRequest({ pathname: '/api/license/status', success: false, rateLimited: true, durationMs: 0 })
  recordLicenseApiRequest({ pathname: '/api/license/status', success: true, durationMs: 15 })

  const metrics = getLicenseApiMetrics()
  const status = metrics.find((m) => m.path === 'status')

  assert.equal(status?.total, 3)
  assert.equal(status?.success, 1)
  assert.equal(status?.failure, 1)
  assert.equal(status?.rateLimited, 1)
})

test('getLicenseApiMetricsSummary 计算成功率', () => {
  recordLicenseApiRequest({ pathname: '/api/license/activate', success: true, durationMs: 10 })
  recordLicenseApiRequest({ pathname: '/api/license/activate', success: true, durationMs: 10 })
  recordLicenseApiRequest({ pathname: '/api/license/activate', success: false, durationMs: 10 })

  const summary = getLicenseApiMetricsSummary()
  assert.equal(summary.total, 3)
  assert.equal(summary.success, 2)
  assert.equal(summary.failure, 1)
  assert.equal(summary.successRate, 66.7) // 2/3 = 66.67 → 66.7
})

test('getLicenseApiMetrics 无请求时返回空数组', () => {
  const metrics = getLicenseApiMetrics()
  assert.deepEqual(metrics, [])
})

test('legacy verify 路径归入 verify 维度', () => {
  recordLicenseApiRequest({ pathname: '/api/verify', success: true, durationMs: 3 })

  const metrics = getLicenseApiMetrics()
  assert.equal(metrics.find((m) => m.path === 'verify')?.total, 1)
})
