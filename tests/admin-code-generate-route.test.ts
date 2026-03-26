import assert from 'node:assert/strict'
import test from 'node:test'

import { NextRequest } from 'next/server'

import * as dbModule from '../src/lib/db'
import * as codesGenerateRouteModule from '../src/app/api/admin/codes/generate/route'
import { bootstrapDevelopmentDatabase } from '../src/lib/dev-bootstrap'
import { createProject } from '../src/lib/license-project-service'
import { signToken } from '../src/lib/jwt'

const { prisma } = dbModule
const { POST } = codesGenerateRouteModule

const silentLogger = {
  log: () => undefined,
  error: () => undefined,
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

function createAdminRequest(url: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(url, init)
}

function createUniqueProjectKey(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

test('激活码批量生成接口会记录管理员审计日志', async (t) => {
  const projectKey = createUniqueProjectKey('route-generate-project')
  const project = await createProject(prisma, {
    name: '批量发码项目',
    projectKey,
  })

  t.after(async () => {
    await prisma.adminOperationAuditLog.deleteMany({
      where: {
        projectId: project.id,
      },
    })
    await prisma.activationCode.deleteMany({
      where: {
        projectId: project.id,
      },
    })
    await prisma.project.deleteMany({
      where: {
        id: project.id,
      },
    })
  })

  const request = createAdminRequest('http://127.0.0.1:3000/api/admin/codes/generate', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: await createAuthCookie(),
    },
    body: JSON.stringify({
      amount: 2,
      projectKey,
      licenseMode: 'COUNT',
      totalCount: 8,
      allowAutoRebind: true,
      autoRebindCooldownMinutes: 120,
      autoRebindMaxCount: 4,
    }),
  })

  const response = await POST(request)
  const body = await response.json()
  const adminLogs = await prisma.adminOperationAuditLog.findMany({
    where: {
      projectId: project.id,
    },
    orderBy: {
      id: 'asc',
    },
  })

  assert.equal(response.status, 200)
  assert.equal(body.success, true)
  assert.equal(body.codes.length, 2)
  assert.deepEqual(
    adminLogs.map((entry) => ({
      operationType: entry.operationType,
      adminUsername: entry.adminUsername,
      targetLabel: entry.targetLabel,
    })),
    [
      {
        operationType: 'CODE_BATCH_GENERATED',
        adminUsername: 'admin',
        targetLabel: projectKey,
      },
    ],
  )

  const detail = JSON.parse(adminLogs[0]?.detailJson ?? '{}') as {
    amount?: number
    licenseMode?: string
    totalCount?: number | null
    autoRebindCooldownMinutes?: number | null
    autoRebindMaxCount?: number | null
  }

  assert.deepEqual(detail, {
    amount: 2,
    licenseMode: 'COUNT',
    validDays: null,
    totalCount: 8,
    autoRebindCooldownMinutes: 120,
    autoRebindMaxCount: 4,
    allowAutoRebind: true,
  })
})
