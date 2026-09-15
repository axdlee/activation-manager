import assert from 'node:assert/strict'
import test from 'node:test'

import { GET as healthGet } from '../src/app/api/health/route'

test('健康检查端点在数据库可用时返回 200 ok', async () => {
  const response = await healthGet()
  assert.equal(response.status, 200)

  const body = (await response.json()) as {
    status: string
    service: string
    time: string
  }
  assert.equal(body.status, 'ok')
  assert.equal(body.service, 'activation-manager')
  assert.ok(!Number.isNaN(Date.parse(body.time)))
})

test('健康检查端点返回 no-store 缓存头', async () => {
  const response = await healthGet()
  assert.equal(response.headers.get('Cache-Control'), 'no-store')
})
