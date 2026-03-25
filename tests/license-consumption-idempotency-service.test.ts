import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildExistingConsumptionResult,
  claimConsumptionRequestId,
} from '../src/lib/license-consumption-idempotency-service'

test('buildExistingConsumptionResult 会为处理中和跨请求复用场景返回冲突结果', () => {
  assert.deepEqual(
    buildExistingConsumptionResult(
      {
        remainingCountAfter: -1,
        machineId: 'machine-001',
        activationCode: {
          code: 'COUNT-CODE-001',
          projectId: 1,
          licenseMode: 'COUNT',
          isUsed: true,
          usedAt: new Date('2026-03-25T00:00:00.000Z'),
          expiresAt: null,
          remainingCount: 1,
          validDays: null,
        },
      } as never,
      {
        code: 'COUNT-CODE-001',
        projectId: 1,
        machineId: 'machine-001',
      },
    ),
    {
      success: false,
      message: 'requestId 正在处理中，请稍后重试',
      status: 409,
    },
  )

  assert.deepEqual(
    buildExistingConsumptionResult(
      {
        remainingCountAfter: 1,
        machineId: 'machine-other',
        activationCode: {
          code: 'COUNT-CODE-001',
          projectId: 1,
          licenseMode: 'COUNT',
          isUsed: true,
          usedAt: new Date('2026-03-25T00:00:00.000Z'),
          expiresAt: null,
          remainingCount: 1,
          validDays: null,
        },
      } as never,
      {
        code: 'COUNT-CODE-001',
        projectId: 1,
        machineId: 'machine-001',
      },
    ),
    {
      success: false,
      message: 'requestId 已被其他请求使用',
      status: 409,
    },
  )
})

test('buildExistingConsumptionResult 会为相同请求返回稳定幂等结果', () => {
  const result = buildExistingConsumptionResult(
    {
      remainingCountAfter: 1,
      machineId: 'machine-001',
      activationCode: {
        code: 'COUNT-CODE-001',
        projectId: 1,
        licenseMode: 'COUNT',
        isUsed: true,
        usedAt: new Date('2026-03-25T00:00:00.000Z'),
        expiresAt: null,
        remainingCount: 1,
        validDays: null,
      },
    } as never,
    {
      code: 'COUNT-CODE-001',
      projectId: 1,
      machineId: 'machine-001',
    },
  )

  assert.deepEqual(result, {
    success: true,
    message: '请求已处理',
    status: 200,
    licenseMode: 'COUNT',
    remainingCount: 1,
    expiresAt: null,
    isActivated: true,
    valid: true,
    idempotent: true,
  })
})

test('claimConsumptionRequestId 在首次占位成功时返回 claimed=true', async () => {
  const createCalls: Array<Record<string, unknown>> = []

  const client = {
    licenseConsumption: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        createCalls.push(data)
        return data
      },
      findUnique: async () => null,
    },
  }

  const result = await claimConsumptionRequestId(
    client as never,
    {
      requestId: 'req-001',
      activationCodeId: 1,
      machineId: 'machine-001',
    },
    {
      code: 'COUNT-CODE-001',
      projectId: 1,
      machineId: 'machine-001',
    },
  )

  assert.equal(result.claimed, true)
  assert.equal(result.existingResult, null)
  assert.equal(createCalls.length, 1)
  assert.equal(createCalls[0]?.remainingCountAfter, -1)
})

test('claimConsumptionRequestId 在 requestId 冲突时返回已结算的幂等结果', async () => {
  const client = {
    licenseConsumption: {
      create: async () => {
        throw {
          code: 'P2002',
          meta: {
            target: ['requestId'],
          },
        }
      },
      findUnique: async () => ({
        remainingCountAfter: 2,
        machineId: 'machine-001',
        activationCode: {
          code: 'COUNT-CODE-001',
          projectId: 1,
          licenseMode: 'COUNT',
          isUsed: true,
          usedAt: new Date('2026-03-25T00:00:00.000Z'),
          expiresAt: null,
          remainingCount: 2,
          validDays: null,
        },
      }),
    },
  }

  const result = await claimConsumptionRequestId(
    client as never,
    {
      requestId: 'req-001',
      activationCodeId: 1,
      machineId: 'machine-001',
    },
    {
      code: 'COUNT-CODE-001',
      projectId: 1,
      machineId: 'machine-001',
    },
  )

  assert.equal(result.claimed, false)
  assert.deepEqual(result.existingResult, {
    success: true,
    message: '请求已处理',
    status: 200,
    licenseMode: 'COUNT',
    remainingCount: 2,
    expiresAt: null,
    isActivated: true,
    valid: true,
    idempotent: true,
  })
})
