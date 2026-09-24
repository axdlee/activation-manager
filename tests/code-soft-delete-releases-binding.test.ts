/**
 * 批次3（v2.9.0 复查中危）回归：软删除释放 usedBy。
 *
 * 修复前：软删除只打 deletedAt，(projectId, usedBy) 唯一约束仍被占用，
 * 冲突解析又排除已删除码 → 「吊销旧码补发新码」在原设备上永远 409。
 * 修复后：软删除同时清空 usedBy（原值进审计 detail.releasedUsedBy），
 * 设备立即释放，可绑定新码。
 *
 * 本文件 spy prisma 客户端（不落库），驱动 deleteActivationCodeRoute
 * 走到 FK 冲突 → 软删除分支，断言写入字段口径。
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { NextRequest } from 'next/server'

import { deleteActivationCodeRoute } from '../src/app/api/admin/codes/delete/route'

function createDeleteRequest(id: number) {
  return new NextRequest('http://127.0.0.1:3000/api/admin/codes/delete', {
    method: 'POST',
    body: JSON.stringify({ id }),
  })
}

test('软删除分支清空 usedBy，原值写入审计 detail.releasedUsedBy', async () => {
  const txCalls: Array<{ kind: string; data?: Record<string, unknown> }> = []
  const auditCreates: Array<Record<string, unknown>> = []
  let transactionRound = 0

  // 第一轮事务：硬删除 → 模拟 FK 约束失败；第二轮：软删除 update 成功
  const client = {
    activationCode: {
      findFirst: async () => ({
        id: 42,
        code: 'TEST-CODE-0042',
        projectId: 1,
        usedBy: 'machine-old-device',
      }),
      update: async (args: { data: Record<string, unknown> }) => {
        txCalls.push({ kind: 'update', data: args.data })
        return {}
      },
      delete: async () => {
        txCalls.push({ kind: 'delete' })
        throw new Error('Foreign key constraint failed on the field: `activationCodeId`')
      },
    },
    shopProductCodeStock: {
      deleteMany: async () => ({ count: 0 }),
    },
    adminOperationAuditLog: {
      create: async (args: Record<string, unknown>) => {
        auditCreates.push(args)
        return {}
      },
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      transactionRound += 1
      return fn(client)
    },
  }

  const response = await deleteActivationCodeRoute(
    createDeleteRequest(42),
    { payload: { username: 'admin' } },
    client as never,
  )
  const body = await response.json()

  assert.equal(body.success, true)
  assert.ok(String(body.message).includes('软删除'), '应走软删除分支')

  // 软删除 update 必须同时带 deletedAt 与 usedBy: null
  const softDeleteUpdate = txCalls.find((call) => call.kind === 'update')
  assert.ok(softDeleteUpdate, '应存在软删除 update')
  assert.ok(softDeleteUpdate!.data!.deletedAt instanceof Date, '应打 deletedAt')
  assert.equal(softDeleteUpdate!.data!.usedBy, null, 'usedBy 必须释放')

  // 审计保留原绑定设备以便追溯
  assert.equal(auditCreates.length, 1)
  const auditData = (auditCreates[0] as { data: { detailJson: string | null } }).data
  const detail = JSON.parse(auditData.detailJson ?? '{}') as { releasedUsedBy?: string }
  assert.equal(detail.releasedUsedBy, 'machine-old-device')
  assert.equal(transactionRound, 2, '硬删除与软删除各一个事务')
})

test('硬删除路径（无绑定历史）不受影响，不写 releasedUsedBy', async () => {
  const auditCreates: Array<Record<string, unknown>> = []

  const client = {
    activationCode: {
      findFirst: async () => ({ id: 7, code: 'TEST-CODE-0007', projectId: 1, usedBy: null }),
      delete: async () => ({}),
      update: async () => {
        throw new Error('不应走到软删除分支')
      },
    },
    shopProductCodeStock: {
      deleteMany: async () => ({ count: 0 }),
    },
    adminOperationAuditLog: {
      create: async (args: Record<string, unknown>) => {
        auditCreates.push(args)
        return {}
      },
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(client),
  }

  const response = await deleteActivationCodeRoute(
    createDeleteRequest(7),
    { payload: { username: 'admin' } },
    client as never,
  )
  const body = await response.json()

  assert.equal(body.success, true)
  const auditData = (auditCreates[0] as { data: { detailJson: string | null } }).data
  const detail = JSON.parse(auditData.detailJson ?? '{}') as { softDeleted?: boolean }
  assert.equal(detail.softDeleted, undefined, '硬删除审计不带 softDeleted 标记')
})
