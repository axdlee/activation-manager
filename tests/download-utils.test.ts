import assert from 'node:assert/strict'
import test from 'node:test'

import { buildExportUrl } from '../src/lib/download-utils'

test('buildExportUrl 带查询参数时拼接问号', () => {
  const params = new URLSearchParams({ projectKey: 'demo' })
  assert.equal(buildExportUrl('/api/admin/consumptions/export', params), '/api/admin/consumptions/export?projectKey=demo')
})

test('buildExportUrl 无查询参数时返回原路径', () => {
  assert.equal(buildExportUrl('/api/admin/consumptions/export', new URLSearchParams()), '/api/admin/consumptions/export')
})