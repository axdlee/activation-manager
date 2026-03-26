import assert from 'node:assert/strict'
import test from 'node:test'

import { generateActivationCodes } from '../src/lib/license-generation-service'

test('generateActivationCodes 会走批量写入路径并按生成顺序返回结果', async () => {
  const createManyCalls: Array<Array<Record<string, unknown>>> = []

  const client = {
    project: {
      findUnique: async () => ({
        id: 2,
        name: '批量项目',
        projectKey: 'batch-project',
        isEnabled: true,
      }),
    },
    activationCode: {
      findUnique: async () => {
        throw new Error('批量发码不应再逐条调用 activationCode.findUnique 探测唯一性')
      },
      createManyAndReturn: async ({ data }: { data: Array<Record<string, unknown>> }) => {
        createManyCalls.push(data)

        return [...data]
          .reverse()
          .map((item) => ({
            ...item,
            id: Number(String(item.code).slice(-2), 16),
            isUsed: false,
            usedAt: null,
            usedBy: null,
            createdAt: new Date('2026-03-25T00:00:00.000Z'),
            updatedAt: new Date('2026-03-25T00:00:00.000Z'),
            expiresAt: null,
            consumedCount: 0,
            project: {
              id: 2,
              name: '批量项目',
              projectKey: 'batch-project',
            },
          }))
      },
    },
  }

  const codes = await generateActivationCodes(client as never, {
    projectKey: 'batch-project',
    amount: 3,
    licenseMode: 'COUNT',
    totalCount: 2,
    cardType: '2次卡',
    allowAutoRebind: true,
    autoRebindCooldownMinutes: 30,
    autoRebindMaxCount: 5,
  })

  assert.equal(createManyCalls.length, 1)
  assert.equal(createManyCalls[0]?.length, 3)
  assert.deepEqual(
    codes.map((item) => item.code),
    createManyCalls[0]?.map((item) => item.code),
  )
  assert.ok(codes.every((item) => item.project.projectKey === 'batch-project'))
  assert.ok(codes.every((item) => item.remainingCount === 2))
  assert.ok(createManyCalls[0]?.every((item) => item.allowAutoRebind === true))
  assert.ok(createManyCalls[0]?.every((item) => item.autoRebindCooldownMinutes === 30))
  assert.ok(createManyCalls[0]?.every((item) => item.autoRebindMaxCount === 5))
})

test('generateActivationCodes 在批次唯一约束冲突时会重试整个批次并最终成功', async () => {
  let callCount = 0

  const client = {
    project: {
      findUnique: async () => ({
        id: 3,
        name: '重试项目',
        projectKey: 'retry-project',
        isEnabled: true,
      }),
    },
    activationCode: {
      findUnique: async () => {
        throw new Error('批量发码重试不应回退到逐条唯一性探测')
      },
      createManyAndReturn: async ({ data }: { data: Array<Record<string, unknown>> }) => {
        callCount += 1

        if (callCount === 1) {
          const error = new Error('Unique constraint failed') as Error & {
            code?: string
            meta?: { target?: string[] }
          }
          error.code = 'P2002'
          error.meta = {
            target: ['code'],
          }
          throw error
        }

        return data.map((item, index) => ({
          ...item,
          id: index + 1,
          isUsed: false,
          usedAt: null,
          usedBy: null,
          createdAt: new Date('2026-03-25T00:00:00.000Z'),
          updatedAt: new Date('2026-03-25T00:00:00.000Z'),
          expiresAt: null,
          consumedCount: 0,
          project: {
            id: 3,
            name: '重试项目',
            projectKey: 'retry-project',
          },
        }))
      },
    },
  }

  const codes = await generateActivationCodes(client as never, {
    projectKey: 'retry-project',
    amount: 2,
    licenseMode: 'TIME',
    validDays: 30,
    cardType: '月卡',
  })

  assert.equal(callCount, 2)
  assert.equal(codes.length, 2)
  assert.ok(new Set(codes.map((item) => item.code)).size === 2)
})
