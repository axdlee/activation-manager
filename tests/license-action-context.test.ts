import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildLicenseConsumptionRequestContext,
  normalizeConsumeLicenseInput,
  normalizeLicenseActionInput,
} from '../src/lib/license-action-context'

test('normalizeLicenseActionInput 会统一 trim projectKey、code 与 machineId', () => {
  assert.deepEqual(
    normalizeLicenseActionInput({
      projectKey: '  plugin-a  ',
      code: '  CODE-001  ',
      machineId: '  machine-001  ',
    }),
    {
      projectKey: 'plugin-a',
      code: 'CODE-001',
      machineId: 'machine-001',
    },
  )
})

test('normalizeConsumeLicenseInput 会额外 trim requestId，并在缺失时保留 undefined', () => {
  assert.deepEqual(
    normalizeConsumeLicenseInput({
      projectKey: '  plugin-a  ',
      code: '  CODE-001  ',
      machineId: '  machine-001  ',
      requestId: '  req-001  ',
    }),
    {
      projectKey: 'plugin-a',
      code: 'CODE-001',
      machineId: 'machine-001',
      requestId: 'req-001',
    },
  )

  assert.deepEqual(
    normalizeConsumeLicenseInput({
      code: 'CODE-001',
      machineId: 'machine-001',
    }),
    {
      projectKey: undefined,
      code: 'CODE-001',
      machineId: 'machine-001',
      requestId: undefined,
    },
  )
})

test('buildLicenseConsumptionRequestContext 会生成稳定的幂等上下文对象', () => {
  assert.deepEqual(
    buildLicenseConsumptionRequestContext({
      projectId: 1,
      code: 'CODE-001',
      machineId: 'machine-001',
    }),
    {
      projectId: 1,
      code: 'CODE-001',
      machineId: 'machine-001',
    },
  )
})
