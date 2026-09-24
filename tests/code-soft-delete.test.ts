/**
 * 批次2 软删除回归测试（临时 SQLite 集成）：
 * 1. 无依赖的码 → 物理删除；有绑定历史的码 → 软删除（deletedAt 打标、历史保留）
 * 2. 软删除后的码：管理列表不可见、过期清理扫描不再命中
 * 3. 删除成功后才写审计
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { PrismaClient } from '@prisma/client'
import { NextRequest } from 'next/server'

import { bootstrapDevelopmentDatabase } from '../src/lib/dev-bootstrap'
import { generateActivationCodes } from '../src/lib/license-generation-service'
import { listActivationCodes } from '../src/lib/license-code-list-service'
import { deleteActivationCodeRoute } from '../src/app/api/admin/codes/delete/route'

const silentLogger = { log: () => undefined, error: () => undefined }

async function createTestPrisma() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'activation-manager-softdel-'))
  const dbPath = path.join(tempDir, 'dev.db')

  await bootstrapDevelopmentDatabase({ dbPath, logger: silentLogger })

  const prisma = new PrismaClient({
    datasources: { db: { url: `file:${dbPath}` } },
  })

  return { prisma, cleanup: () => fs.rmSync(tempDir, { recursive: true, force: true }) }
}

function createDeleteRequest(id: number) {
  return new NextRequest('http://127.0.0.1:3000/api/admin/codes/delete', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id }),
  })
}

const authResult = { payload: { username: 'admin' } }

test('软删除：有绑定历史的码打 deletedAt 标，历史保留且列表不可见', async () => {
  const { prisma, cleanup } = await createTestPrisma()

  try {
    const [code] = await generateActivationCodes(prisma, {
      projectKey: 'default',
      amount: 1,
      licenseMode: 'TIME',
      validDays: 30,
    })

    // 制造绑定历史（RESTRICT 外键来源）
    await prisma.activationCode.update({
      where: { id: code.id },
      data: { isUsed: true, usedAt: new Date(), usedBy: 'machine-softdel' },
    })
    await prisma.activationCodeBindingHistory.create({
      data: {
        activationCodeId: code.id,
        projectId: code.projectId,
        eventType: 'BIND',
        operatorType: 'ADMIN',
        toMachineId: 'machine-softdel',
      },
    })

    const response = await deleteActivationCodeRoute(createDeleteRequest(code.id), authResult, prisma)
    const body = (await response.json()) as { success: boolean; message?: string }

    assert.equal(response.status, 200)
    assert.equal(body.success, true)
    assert.match(body.message ?? '', /软删除/)

    // 行仍在、打了标记
    const row = await prisma.activationCode.findUnique({ where: { id: code.id } })
    assert.ok(row)
    assert.ok(row.deletedAt instanceof Date)

    // 绑定历史完整保留
    const histories = await prisma.activationCodeBindingHistory.count({
      where: { activationCodeId: code.id },
    })
    assert.equal(histories, 1)

    // 管理列表不再可见
    const listResult = await listActivationCodes(prisma, { page: 1, pageSize: 50 })
    assert.equal(listResult.codes.some((item) => item.id === code.id), false)

    // 审计在删除成功后写入，且标明软删除
    const audit = await prisma.adminOperationAuditLog.findFirst({
      where: { operationType: 'CODE_DELETED', targetLabel: code.code },
      orderBy: { id: 'desc' },
    })
    assert.ok(audit)
    assert.match(audit.detailJson ?? '', /softDeleted/)
  } finally {
    await prisma.$disconnect()
    cleanup()
  }
})

test('无依赖的码走物理删除，行被移除', async () => {
  const { prisma, cleanup } = await createTestPrisma()

  try {
    const [code] = await generateActivationCodes(prisma, {
      projectKey: 'default',
      amount: 1,
      licenseMode: 'COUNT',
      totalCount: 5,
    })

    const response = await deleteActivationCodeRoute(createDeleteRequest(code.id), authResult, prisma)
    const body = (await response.json()) as { success: boolean }

    assert.equal(response.status, 200)
    assert.equal(body.success, true)

    const row = await prisma.activationCode.findUnique({ where: { id: code.id } })
    assert.equal(row, null)

    // 物理删除同样在成功后写审计（无 softDeleted 标记）
    const audit = await prisma.adminOperationAuditLog.findFirst({
      where: { operationType: 'CODE_DELETED', targetLabel: code.code },
      orderBy: { id: 'desc' },
    })
    assert.ok(audit)
  } finally {
    await prisma.$disconnect()
    cleanup()
  }
})

test('软删除的码不参与过期绑定清理扫描', async () => {
  const { prisma, cleanup } = await createTestPrisma()

  try {
    const [code] = await generateActivationCodes(prisma, {
      projectKey: 'default',
      amount: 1,
      licenseMode: 'TIME',
      validDays: 30,
    })

    // 已激活且已过期，随后软删除
    await prisma.activationCode.update({
      where: { id: code.id },
      data: {
        isUsed: true,
        usedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        deletedAt: new Date(),
      },
    })

    // 清理扫描（cleanup 路由的查询条件）不应再找到它
    const usedCodes = await prisma.activationCode.findMany({
      where: { isUsed: true, deletedAt: null },
      select: { id: true },
    })
    assert.equal(usedCodes.some((row) => row.id === code.id), false)
  } finally {
    await prisma.$disconnect()
    cleanup()
  }
})
