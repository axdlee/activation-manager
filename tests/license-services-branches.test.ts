/**
 * License 服务（async + mock prisma）：列表查询 / 换绑设置更新 / 强制解绑·换绑 / 消费日志查询。
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { listActivationCodes } from '../src/lib/license-code-list-service'
import {
  updateActivationCodeRebindSettings,
  forceUnbindActivationCode,
  forceRebindActivationCode,
} from '../src/lib/license-code-admin-service'
import { listLicenseConsumptions } from '../src/lib/license-consumption-service'

function makePrisma(overrides: Record<string, unknown> = {}) {
  const codeRow = {
    id: 1,
    code: 'CODE-001',
    licenseMode: 'COUNT',
    isUsed: false,
    usedAt: null,
    expiresAt: null,
    validDays: null,
    remainingCount: 5,
    totalCount: 10,
    isEnabled: true,
    status: 'ACTIVE',
    project: { id: 1, name: '演示项目', projectKey: 'demo' },
    bindingHistories: [],
    adminAuditLogs: [],
  }
  return {
    activationCode: {
      findMany: async () => [codeRow, { ...codeRow, id: 2, code: 'CODE-002', isUsed: true, remainingCount: null }],
      update: async (args: { data: Record<string, unknown> }) => ({ ...codeRow, ...args.data }),
      findUnique: async () => codeRow,
      // 服务层按 code/id 查码已改 findFirst（排除软删除行）
      findFirst: async () => codeRow,
      ...(overrides.activationCode ?? {}),
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(overrides.tx ?? { activationCode: { update: async (args: { data: Record<string, unknown> }) => ({ ...codeRow, ...args.data }), findUnique: async () => codeRow, findFirst: async () => codeRow } }),
    licenseConsumption: {
      findMany: async () => [
        {
          id: 3,
          requestId: 'req-1',
          machineId: 'machine-1',
          remainingCountAfter: 4,
          createdAt: new Date('2026-09-18T00:00:00Z'),
          activationCode: {
            id: 1,
            code: 'CODE-001',
            licenseMode: 'COUNT',
            totalCount: 10,
            remainingCount: 4,
            project: { name: '演示项目', projectKey: 'demo' },
          },
        },
      ],
      count: async () => 1,
    },
  } as unknown as Parameters<typeof listActivationCodes>[0]
}

test('listActivationCodes：默认全量返回 + 状态徽标字段', async () => {
  const result = await listActivationCodes(makePrisma())
  assert.ok(result.codes.length >= 2)
  assert.ok(result.statusSummary)
  assert.ok(typeof result.projectCoverage === 'number' || result.projectCoverage === undefined)
})

test('listActivationCodes：显式分页参数走分页分支', async () => {
  const result = await listActivationCodes(makePrisma(), { page: 1, pageSize: 1 })
  assert.ok(result.codes.length >= 1)
})

test('updateActivationCodeRebindSettings：更新成功返回结果', async () => {
  const client = makePrisma()
  const result = await updateActivationCodeRebindSettings(client as never, {
    id: 1,
    policyValue: 'inherit',
    cooldownMinutesValue: '30',
    maxCountValue: '5',
    reason: '调整策略',
  } as never)
  assert.ok(result)
})

test('forceUnbindActivationCode：执行成功', async () => {
  const result = await forceUnbindActivationCode(makePrisma() as never, {
    id: 1,
    machineId: 'machine-1',
    reason: '设备遗失',
  } as never)
  assert.ok(result)
})

test('forceRebindActivationCode：已绑定码执行成功', async () => {
  const boundRow = {
    id: 1,
    code: 'CODE-001',
    licenseMode: 'COUNT',
    isUsed: true,
    usedBy: 'machine-1',
    remainingCount: 5,
    totalCount: 10,
    expiresAt: null,
    projectId: 1,
    project: { id: 1, name: '演示项目', projectKey: 'demo' },
  }
  const txProxy = new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === 'activationCode') {
          return {
            findUnique: async () => boundRow,
            findFirst: async () => boundRow,
            count: async () => 0,
            findMany: async () => [],
            update: async (args: { data: Record<string, unknown> }) => ({ ...boundRow, ...args.data }),
            create: async (args: { data: Record<string, unknown> }) => ({ ...boundRow, ...args.data }),
          }
        }
        return () => ({})
      },
    },
  )
  const client = makePrisma({ tx: txProxy })
  const result = await forceRebindActivationCode(client as never, {
    id: 1,
    machineId: 'machine-2',
    reason: '换绑设备',
  } as never)
  assert.ok(result)
})

test('listLicenseConsumptions：返回日志与分页信息', async () => {
  const client = makePrisma()
  const result = await listLicenseConsumptions(client as never, {})
  assert.ok(result)
})
