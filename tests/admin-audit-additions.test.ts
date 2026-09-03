import assert from 'node:assert/strict'
import test from 'node:test'

import bcrypt from 'bcryptjs'
import { NextRequest } from 'next/server'

import * as dbModule from '../src/lib/db'
import * as deleteCodeRouteModule from '../src/app/api/admin/codes/delete/route'
import * as cleanupRouteModule from '../src/app/api/admin/codes/cleanup/route'
import { bootstrapDevelopmentDatabase } from '../src/lib/dev-bootstrap'
import { createProject } from '../src/lib/license-project-service'
import { signToken } from '../src/lib/jwt'
import {
  adminLoginRouteDependencies,
} from '../src/lib/admin-login-route-handler'
import type { AsyncAdminLoginRateLimiter } from '../src/lib/admin-login-rate-limit'
import * as loginRouteModule from '../src/app/api/admin/login/route'

const { prisma } = dbModule
const deleteCodeDELETE = deleteCodeRouteModule.DELETE
const cleanupPOST = cleanupRouteModule.POST
const loginPOST = loginRouteModule.POST

const silentLogger = {
  log: () => undefined,
  error: () => undefined,
}

function createAsyncRateLimiter(): AsyncAdminLoginRateLimiter {
  return {
    check: async () => ({ allowed: true, retryAfterSeconds: 0 }),
    recordFailure: async () => undefined,
    reset: async () => undefined,
    clear: async () => undefined,
  }
}

// 先清依赖（激活码 → 审计）再删项目，避免 FK 导致清理失败
async function cleanupProjectWithAuditLogs(projectId: number) {
  await prisma.adminOperationAuditLog.deleteMany({ where: { projectId } })
  await prisma.activationCode.deleteMany({ where: { projectId } })
  await prisma.project.deleteMany({ where: { id: projectId } })
}

test.before(async () => {
  await bootstrapDevelopmentDatabase({
    logger: silentLogger,
  })
})

test.after(async () => {
  await prisma.$disconnect()
})

async function createAuthCookie() {
  const token = await signToken({ username: 'admin', isAdmin: true })
  return `auth-token=${token}`
}

function createUniqueProjectKey(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

test('删除激活码接口会记录 CODE_DELETED 审计日志', async (t) => {
  const projectKey = createUniqueProjectKey('route-delete-audit')
  const project = await createProject(prisma, {
    name: '删除审计项目',
    projectKey,
  })

  const code = await prisma.activationCode.create({
    data: {
      code: `DEL${Date.now().toString(36).toUpperCase()}AUDIT`,
      projectId: project.id,
      isUsed: false,
      licenseMode: 'COUNT',
      totalCount: 3,
      remainingCount: 3,
    },
  })

  t.after(async () => {
    await cleanupProjectWithAuditLogs(project.id)
  })

  const response = await deleteCodeDELETE(
    new NextRequest('http://127.0.0.1:3000/api/admin/codes/delete', {
      method: 'DELETE',
      headers: {
        cookie: await createAuthCookie(),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ id: code.id }),
    }),
  )
  assert.equal(response.status, 200)

  // 删除激活码后 Prisma 会将审计行 activationCodeId 置空（SetNull），
  // 因此按 targetLabel（激活码串）定位审计记录
  const auditLogs = await prisma.adminOperationAuditLog.findMany({
    where: {
      operationType: 'CODE_DELETED',
      targetLabel: code.code,
    },
  })
  assert.equal(auditLogs.length, 1)
  assert.equal(auditLogs[0].adminUsername, 'admin')
  assert.equal(auditLogs[0].projectId, project.id)
})

test('清理过期激活码接口会记录 CODE_CLEANUP_EXPIRED 审计日志', async (t) => {
  const projectKey = createUniqueProjectKey('route-cleanup-audit')
  const project = await createProject(prisma, {
    name: '清理审计项目',
    projectKey,
  })

  await prisma.activationCode.create({
    data: {
      code: `CLN${Date.now().toString(36).toUpperCase()}AUDIT`,
      projectId: project.id,
      isUsed: true,
      usedAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
      usedBy: 'machine-cleanup-audit',
      licenseMode: 'TIME',
      validDays: 30,
      expiresAt: null,
    },
  })

  t.after(async () => {
    await cleanupProjectWithAuditLogs(project.id)
  })

  const beforeCount = await prisma.adminOperationAuditLog.count({
    where: {
      operationType: 'CODE_CLEANUP_EXPIRED',
      adminUsername: 'admin',
    },
  })

  const response = await cleanupPOST(
    new NextRequest('http://127.0.0.1:3000/api/admin/codes/cleanup', {
      method: 'POST',
      headers: {
        cookie: await createAuthCookie(),
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    }),
  )
  assert.equal(response.status, 200)

  const body = (await response.json()) as { cleaned: number }
  assert.ok(body.cleaned >= 1)

  const afterCount = await prisma.adminOperationAuditLog.count({
    where: {
      operationType: 'CODE_CLEANUP_EXPIRED',
      adminUsername: 'admin',
    },
  })
  assert.equal(afterCount, beforeCount + 1)
})

test('管理员登录成功会记录 ADMIN_LOGIN 审计日志', async (t) => {
  const originalFindAdmin = prisma.admin.findUnique.bind(prisma.admin)
  const originalFindSystemConfig = prisma.systemConfig.findUnique.bind(prisma.systemConfig)
  const originalCompare = bcrypt.compare
  const originalRateLimiter = adminLoginRouteDependencies.rateLimiter

  adminLoginRouteDependencies.rateLimiter = createAsyncRateLimiter()

  ;(prisma.admin as typeof prisma.admin & { findUnique: typeof prisma.admin.findUnique }).findUnique = async () => ({
    id: 1,
    username: 'admin',
    password: 'hashed-password',
    createdAt: new Date('2026-03-24T00:00:00.000Z'),
    updatedAt: new Date('2026-03-24T00:00:00.000Z'),
  })

  ;(
    prisma.systemConfig as typeof prisma.systemConfig & {
      findUnique: typeof prisma.systemConfig.findUnique
    }
  ).findUnique = async ({ where }: { where: { key: string } }) => {
    if (where.key === 'jwtSecret') {
      return {
        id: 1,
        key: 'jwtSecret',
        value: 'unit-test-secret',
        description: 'JWT密钥',
        createdAt: new Date('2026-03-24T00:00:00.000Z'),
        updatedAt: new Date('2026-03-24T00:00:00.000Z'),
      }
    }

    if (where.key === 'jwtExpiresIn') {
      return {
        id: 2,
        key: 'jwtExpiresIn',
        value: '7d',
        description: 'JWT过期时间',
        createdAt: new Date('2026-03-24T00:00:00.000Z'),
        updatedAt: new Date('2026-03-24T00:00:00.000Z'),
      }
    }

    return null
  }

  ;(bcrypt as typeof bcrypt & { compare: typeof bcrypt.compare }).compare = async () => true

  t.after(async () => {
    prisma.admin.findUnique = originalFindAdmin
    prisma.systemConfig.findUnique = originalFindSystemConfig
    bcrypt.compare = originalCompare
    adminLoginRouteDependencies.rateLimiter = originalRateLimiter
    await prisma.adminOperationAuditLog.deleteMany({
      where: { operationType: 'ADMIN_LOGIN' },
    })
  })

  const beforeCount = await prisma.adminOperationAuditLog.count({
    where: { operationType: 'ADMIN_LOGIN' },
  })

  const response = await loginPOST(
    new NextRequest('http://127.0.0.1:3000/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'whatever' }),
    }),
  )
  assert.equal(response.status, 200)

  const afterCount = await prisma.adminOperationAuditLog.count({
    where: { operationType: 'ADMIN_LOGIN' },
  })
  assert.equal(afterCount, beforeCount + 1)

  const latestLoginLog = await prisma.adminOperationAuditLog.findFirst({
    where: {
      operationType: 'ADMIN_LOGIN',
      adminUsername: 'admin',
    },
    orderBy: { id: 'desc' },
  })
  assert.ok(latestLoginLog)
  assert.ok(latestLoginLog.targetLabel === 'admin')
})
