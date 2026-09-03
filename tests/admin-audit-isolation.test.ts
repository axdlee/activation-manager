import assert from 'node:assert/strict'
import test from 'node:test'

import { recordAdminOperationAuditLog } from '../src/lib/admin-operation-audit-service'

test('审计写入失败时静默返回 null，不抛错不阻塞业务', async () => {
  const failingClient = {
    adminOperationAuditLog: {
      create: async () => {
        throw new Error('database is locked')
      },
    },
  }

  const originalConsoleError = console.error
  console.error = () => undefined
  try {
    const result = await recordAdminOperationAuditLog(failingClient as never, {
      adminUsername: 'admin',
      operationType: 'ADMIN_LOGIN',
      targetLabel: 'admin',
    })
    assert.equal(result, null)
  } finally {
    console.error = originalConsoleError
  }
})

test('审计写入成功返回创建记录', async () => {
  const createdLog = { id: 1, operationType: 'ADMIN_LOGIN' }
  const okClient = {
    adminOperationAuditLog: {
      create: async (args: unknown) => {
        assert.ok(args)
        return createdLog
      },
    },
  }

  const result = await recordAdminOperationAuditLog(okClient as never, {
    adminUsername: 'admin',
    operationType: 'ADMIN_LOGIN',
    targetLabel: 'admin',
  })
  assert.equal(result, createdLog)
})

test('adminUsername 为空仍抛参数错误（程序缺陷，不静默）', async () => {
  const okClient = {
    adminOperationAuditLog: {
      create: async () => ({ id: 1 }),
    },
  }

  await assert.rejects(
    () =>
      recordAdminOperationAuditLog(okClient as never, {
        adminUsername: '   ',
        operationType: 'ADMIN_LOGIN',
      }),
    /adminUsername 不能为空/,
  )
})