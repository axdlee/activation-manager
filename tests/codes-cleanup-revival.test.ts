/**
 * 「清理过期绑定」复活回归测试：
 * 修复前 updateMany 把 isUsed/usedAt/expiresAt/validDays 一并清零，
 * 过期授权换台新设备激活就「复活」拿到完整时长。
 * 修复后只允许清 usedBy / lastBoundAt（设备绑定字段）。
 *
 * 本文件 spy 全局 prisma（不落库），断言写入的数据字段口径。
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { NextRequest } from 'next/server'

import * as dbModule from '../src/lib/db'
import { signToken } from '../src/lib/jwt'
import { POST, GET } from '../src/app/api/admin/codes/cleanup/route'

const { prisma } = dbModule

interface CleanupCode {
  id: number
  code: string
  isUsed: boolean
  usedAt: Date
  usedBy: string
  createdAt: Date
  expiresAt: Date | null
  validDays: number | null
  licenseMode: string
}

async function withMockedPrisma(
  codes: CleanupCode[],
  run: (calls: {
    findMany: Array<Record<string, unknown>>
    updateMany: Array<Record<string, unknown>>
  }) => Promise<void>,
) {
  const calls = {
    findMany: [] as Array<Record<string, unknown>>,
    updateMany: [] as Array<Record<string, unknown>>,
  }

  const originalSystemConfigFindUnique = prisma.systemConfig.findUnique.bind(
    prisma.systemConfig,
  )
  const originalFindMany = prisma.activationCode.findMany.bind(prisma.activationCode)
  const originalUpdateMany = prisma.activationCode.updateMany.bind(prisma.activationCode)
  const originalAuditCreate = prisma.adminOperationAuditLog.create.bind(
    prisma.adminOperationAuditLog,
  )

  prisma.systemConfig.findUnique = (async () => null) as unknown as typeof prisma.systemConfig.findUnique
  prisma.activationCode.findMany = (async (args: Record<string, unknown>) => {
    calls.findMany.push(args)
    return codes
  }) as unknown as typeof prisma.activationCode.findMany
  prisma.activationCode.updateMany = (async (args: Record<string, unknown>) => {
    calls.updateMany.push(args)
    return { count: codes.length }
  }) as unknown as typeof prisma.activationCode.updateMany
  prisma.adminOperationAuditLog.create = (async () => ({})) as unknown as typeof prisma.adminOperationAuditLog.create

  try {
    await run(calls)
  } finally {
    prisma.systemConfig.findUnique = originalSystemConfigFindUnique
    prisma.activationCode.findMany = originalFindMany
    prisma.activationCode.updateMany = originalUpdateMany
    prisma.adminOperationAuditLog.create = originalAuditCreate
  }
}

test('清理过期绑定：只清设备绑定字段，绝不重置 isUsed/expiresAt/usedAt/validDays', async () => {
  const now = Date.now()
  const codes: CleanupCode[] = [
    {
      id: 1,
      code: 'TIME-EXPIRED-001',
      isUsed: true,
      usedAt: new Date(now - 40 * 24 * 60 * 60 * 1000),
      usedBy: 'machine-A',
      createdAt: new Date(now - 41 * 24 * 60 * 60 * 1000),
      expiresAt: null,
      validDays: 30,
      licenseMode: 'TIME',
    },
  ]

  await withMockedPrisma(codes, async (calls) => {
    const token = await signToken({ username: 'admin', isAdmin: true })
    const request = new NextRequest('http://127.0.0.1:3000/api/admin/codes/cleanup', {
      method: 'POST',
      headers: { cookie: `auth-token=${token}` },
    })
    const response = await POST(request)
    const body = (await response.json()) as { success: boolean; cleaned: number }

    assert.equal(response.status, 200)
    assert.equal(body.success, true)
    assert.equal(body.cleaned, 1)

    assert.equal(calls.updateMany.length, 1)
    const data = calls.updateMany[0].data as Record<string, unknown>
    // 只允许清设备绑定字段——这是「过期授权复活」漏洞的回归断言
    assert.deepEqual(Object.keys(data).sort(), ['lastBoundAt', 'usedBy'])
    assert.equal(data.usedBy, null)
    assert.equal(data.lastBoundAt, null)
    // 查询范围必须限定已使用的码
    const where = calls.findMany[0].where as Record<string, unknown>
    assert.deepEqual(where, { isUsed: true })
  })
})

test('清理过期绑定：COUNT 码不进入清理范围（剩余次数不能送给新设备）', async () => {
  const now = Date.now()
  const codes: CleanupCode[] = [
    {
      id: 2,
      code: 'COUNT-OLD-001',
      isUsed: true,
      usedAt: new Date(now - 400 * 24 * 60 * 60 * 1000),
      usedBy: 'machine-B',
      createdAt: new Date(now - 401 * 24 * 60 * 60 * 1000),
      expiresAt: new Date(now - 100 * 24 * 60 * 60 * 1000),
      validDays: null,
      licenseMode: 'COUNT',
    },
  ]

  await withMockedPrisma(codes, async (calls) => {
    const token = await signToken({ username: 'admin', isAdmin: true })
    const request = new NextRequest('http://127.0.0.1:3000/api/admin/codes/cleanup', {
      method: 'POST',
      headers: { cookie: `auth-token=${token}` },
    })
    const response = await POST(request)
    const body = (await response.json()) as { success: boolean; cleaned: number; message: string }

    assert.equal(response.status, 200)
    assert.equal(body.cleaned, 0)
    assert.equal(calls.updateMany.length, 0)
    assert.match(body.message, /没有找到/)
  })
})

test('过期统计 GET：COUNT 码不计入过期', async () => {
  const now = Date.now()
  const codes: CleanupCode[] = [
    {
      id: 3,
      code: 'TIME-EXPIRED-002',
      isUsed: true,
      usedAt: new Date(now - 40 * 24 * 60 * 60 * 1000),
      usedBy: 'machine-C',
      createdAt: new Date(now - 41 * 24 * 60 * 60 * 1000),
      expiresAt: null,
      validDays: 30,
      licenseMode: 'TIME',
    },
    {
      id: 4,
      code: 'COUNT-OLD-002',
      isUsed: true,
      usedAt: new Date(now - 400 * 24 * 60 * 60 * 1000),
      usedBy: 'machine-D',
      createdAt: new Date(now - 401 * 24 * 60 * 60 * 1000),
      expiresAt: new Date(now - 100 * 24 * 60 * 60 * 1000),
      validDays: null,
      licenseMode: 'COUNT',
    },
  ]

  await withMockedPrisma(codes, async () => {
    const token = await signToken({ username: 'admin', isAdmin: true })
    const request = new NextRequest('http://127.0.0.1:3000/api/admin/codes/cleanup', {
      method: 'GET',
      headers: { cookie: `auth-token=${token}` },
    })
    const response = await GET(request)
    const body = (await response.json()) as { success: boolean; count: number }

    assert.equal(response.status, 200)
    assert.equal(body.count, 1)
  })
})
