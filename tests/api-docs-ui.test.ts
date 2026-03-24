import assert from 'node:assert/strict'
import test from 'node:test'

import { buildApiDocsPageModel } from '../src/lib/api-docs-ui'

test('buildApiDocsPageModel 会返回正式接口、兼容接口与多语言示例', () => {
  const model = buildApiDocsPageModel()

  assert.equal(model.summaryCards.length, 3)
  assert.equal(model.endpoints.filter((endpoint) => endpoint.audience === 'recommended').length, 3)
  assert.equal(model.endpoints.some((endpoint) => endpoint.path === '/api/verify'), true)
  assert.deepEqual(
    model.languageSnippets.map((snippet) => snippet.key),
    ['sdk', 'python', 'curl'],
  )
})

test('buildApiDocsPageModel 会强调 consume 幂等与推荐调研路径', () => {
  const model = buildApiDocsPageModel()
  const consumeEndpoint = model.endpoints.find((endpoint) => endpoint.key === 'consume')

  assert.ok(consumeEndpoint)
  assert.equal(
    consumeEndpoint?.highlights.some((item) => item.includes('requestId')),
    true,
  )
  assert.equal(
    model.researchSteps.some((step) => step.title.includes('smoke')),
    true,
  )
})
