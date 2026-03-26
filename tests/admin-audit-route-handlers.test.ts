import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { PrismaClient } from '@prisma/client'

import {
  handleExportAdminOperationAuditLogsRequest,
  handleListAdminOperationAuditLogsRequest,
} from '../src/lib/admin-audit-route-handlers'
import { recordAdminOperationAuditLog } from '../src/lib/admin-operation-audit-service'
import { bootstrapDevelopmentDatabase } from '../src/lib/dev-bootstrap'
import { generateActivationCodes } from '../src/lib/license-generation-service'
import { createProject } from '../src/lib/license-project-service'

const silentLogger = {
  log: () => undefined,
  error: () => undefined,
}

async function createTestPrisma() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'activation-manager-admin-audit-'))
  const dbPath = path.join(tempDir, 'dev.db')

  await bootstrapDevelopmentDatabase({
    dbPath,
    logger: silentLogger,
  })

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: `file:${dbPath}`,
      },
    },
  })

  return { prisma }
}

test('管理员审计日志列表处理器支持项目、关键字、操作类型与分页过滤', async () => {
  const { prisma } = await createTestPrisma()

  try {
    const project = await createProject(prisma, {
      name: '插件项目',
      projectKey: 'audit-plugin',
    })
    const otherProject = await createProject(prisma, {
      name: '桌面端项目',
      projectKey: 'audit-desktop',
    })

    const [pluginCode] = await generateActivationCodes(prisma, {
      projectKey: 'audit-plugin',
      amount: 1,
      licenseMode: 'COUNT',
      totalCount: 5,
    })

    await recordAdminOperationAuditLog(prisma, {
      adminUsername: 'alice',
      operationType: 'PROJECT_CREATED',
      projectId: project.id,
      targetLabel: 'audit-plugin',
      detail: {
        source: 'seed',
      },
    })
    await recordAdminOperationAuditLog(prisma, {
      adminUsername: 'alice',
      operationType: 'CODE_BATCH_GENERATED',
      projectId: project.id,
      targetLabel: 'audit-plugin',
      detail: {
        amount: 10,
      },
    })
    await recordAdminOperationAuditLog(prisma, {
      adminUsername: 'bob',
      operationType: 'CODE_FORCE_REBIND',
      activationCodeId: pluginCode.id,
      projectId: project.id,
      targetLabel: pluginCode.code,
      reason: '用户换电脑',
      detail: {
        fromMachineId: 'old-machine',
        toMachineId: 'new-machine',
      },
    })
    await recordAdminOperationAuditLog(prisma, {
      adminUsername: 'carol',
      operationType: 'PROJECT_REBIND_SETTINGS_UPDATED',
      projectId: otherProject.id,
      targetLabel: 'audit-desktop',
      detail: {
        allowAutoRebind: false,
      },
    })

    await prisma.adminOperationAuditLog.updateMany({
      where: {
        adminUsername: 'alice',
        operationType: 'PROJECT_CREATED',
      },
      data: {
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
      },
    })
    await prisma.adminOperationAuditLog.updateMany({
      where: {
        adminUsername: 'alice',
        operationType: 'CODE_BATCH_GENERATED',
      },
      data: {
        createdAt: new Date('2026-03-02T00:00:00.000Z'),
      },
    })
    await prisma.adminOperationAuditLog.updateMany({
      where: {
        adminUsername: 'bob',
        operationType: 'CODE_FORCE_REBIND',
      },
      data: {
        createdAt: new Date('2026-03-03T00:00:00.000Z'),
      },
    })
    await prisma.adminOperationAuditLog.updateMany({
      where: {
        adminUsername: 'carol',
        operationType: 'PROJECT_REBIND_SETTINGS_UPDATED',
      },
      data: {
        createdAt: new Date('2026-03-04T00:00:00.000Z'),
      },
    })

    const response = await handleListAdminOperationAuditLogsRequest(
      new Request(
        'http://127.0.0.1:3000/api/admin/audit-logs?projectKey=audit-plugin&keyword=电脑&operationType=CODE_FORCE_REBIND&page=1&pageSize=1',
        {
          method: 'GET',
        },
      ),
      prisma,
    )

    assert.equal(response.status, 200)
    const payload = await response.json()

    assert.equal(payload.success, true)
    assert.equal(payload.logs.length, 1)
    assert.equal(payload.logs[0]?.adminUsername, 'bob')
    assert.equal(payload.logs[0]?.operationType, 'CODE_FORCE_REBIND')
    assert.equal(payload.logs[0]?.project?.projectKey, 'audit-plugin')
    assert.equal(payload.logs[0]?.activationCode?.code, pluginCode.code)
    assert.deepEqual(payload.pagination, {
      total: 1,
      page: 1,
      pageSize: 1,
      totalPages: 1,
    })
  } finally {
    await prisma.$disconnect()
  }
})

test('管理员审计日志导出处理器返回 CSV 文件，并支持时间范围与项目过滤', async () => {
  const { prisma } = await createTestPrisma()

  try {
    const project = await createProject(prisma, {
      name: '审计导出项目',
      projectKey: 'audit-export-project',
    })
    const otherProject = await createProject(prisma, {
      name: '其他导出项目',
      projectKey: 'other-audit-export-project',
    })

    await recordAdminOperationAuditLog(prisma, {
      adminUsername: 'admin',
      operationType: 'PROJECT_CREATED',
      projectId: project.id,
      targetLabel: 'audit-export-project',
    })
    await recordAdminOperationAuditLog(prisma, {
      adminUsername: 'admin',
      operationType: 'CODE_BATCH_GENERATED',
      projectId: project.id,
      targetLabel: 'audit-export-project',
      reason: '首批导入',
      detail: {
        amount: 20,
      },
    })
    await recordAdminOperationAuditLog(prisma, {
      adminUsername: 'admin',
      operationType: 'PROJECT_CREATED',
      projectId: otherProject.id,
      targetLabel: 'other-audit-export-project',
    })

    await prisma.adminOperationAuditLog.updateMany({
      where: {
        projectId: project.id,
        operationType: 'PROJECT_CREATED',
      },
      data: {
        createdAt: new Date('2026-01-05T00:00:00.000Z'),
      },
    })
    await prisma.adminOperationAuditLog.updateMany({
      where: {
        projectId: project.id,
        operationType: 'CODE_BATCH_GENERATED',
      },
      data: {
        createdAt: new Date('2026-03-05T00:00:00.000Z'),
      },
    })

    const response = await handleExportAdminOperationAuditLogsRequest(
      new Request(
        'http://127.0.0.1:3000/api/admin/audit-logs/export?projectKey=audit-export-project&createdFrom=2026-03-01T00:00:00.000Z&createdTo=2026-03-31T23:59:59.999Z',
        {
          method: 'GET',
        },
      ),
      prisma,
    )

    assert.equal(response.status, 200)
    assert.match(response.headers.get('content-type') || '', /^text\/csv/)
    assert.match(
      response.headers.get('content-disposition') || '',
      /^attachment; filename=\"admin_audit_logs_\d{4}-\d{2}-\d{2}\.csv\"$/,
    )

    const body = await response.text()

    assert.ok(
      body.replace(/^\uFEFF/, '').startsWith(
        '管理员,操作类型,项目,项目标识,激活码,目标,原因,详情,操作时间',
      ),
    )
    assert.match(body, /审计导出项目/)
    assert.match(body, /批量生成激活码/)
    assert.match(body, /首批导入/)
    assert.doesNotMatch(body, /2026-01-05T00:00:00.000Z/)
    assert.doesNotMatch(body, /other-audit-export-project/)
  } finally {
    await prisma.$disconnect()
  }
})

test('管理员审计日志列表处理器在项目筛选命中不存在项目时返回空结果，而不是回退为全量日志', async () => {
  const { prisma } = await createTestPrisma()

  try {
    const project = await createProject(prisma, {
      name: '存在的项目',
      projectKey: 'existing-audit-project',
    })

    await recordAdminOperationAuditLog(prisma, {
      adminUsername: 'admin',
      operationType: 'PROJECT_CREATED',
      projectId: project.id,
      targetLabel: project.projectKey,
    })

    const response = await handleListAdminOperationAuditLogsRequest(
      new Request(
        'http://127.0.0.1:3000/api/admin/audit-logs?projectKey=missing-audit-project',
        {
          method: 'GET',
        },
      ),
      prisma,
    )

    assert.equal(response.status, 200)
    const payload = await response.json()

    assert.equal(payload.success, true)
    assert.deepEqual(payload.logs, [])
    assert.deepEqual(payload.pagination, {
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    })
  } finally {
    await prisma.$disconnect()
  }
})
