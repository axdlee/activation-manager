import assert from 'node:assert/strict'
import test from 'node:test'

import { NextRequest } from 'next/server'

import * as dbModule from '../src/lib/db'
import * as codesListRouteModule from '../src/app/api/admin/codes/list/route'
import * as codeDetailRouteModule from '../src/app/api/admin/codes/[id]/route'
import { bootstrapDevelopmentDatabase } from '../src/lib/dev-bootstrap'
import { createProject } from '../src/lib/license-project-service'
import { signToken } from '../src/lib/jwt'

const { prisma } = dbModule
const listGET = codesListRouteModule.GET
const detailGET = codeDetailRouteModule.GET

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

function createUniqueProjectKey(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

async function seedCodes(projectId: number, count: number) {
  const prefix = Date.now().toString(36).toUpperCase()
  const created: Array<{ id: number; code: string }> = []

  for (let i = 0; i < count; i += 1) {
    const code = `PG${prefix}${String(i).padStart(2, '0')}`
    const row = await prisma.activationCode.create({
      data: {
        code,
        projectId,
        isUsed: false,
        licenseMode: 'COUNT',
        totalCount: 5,
        remainingCount: 5,
      },
    })
    created.push({ id: row.id, code })
  }

  return created
}

test('激活码列表接口支持分页返回 total/totalPages', async (t) => {
  const projectKey = createUniqueProjectKey('route-page-project')
  const project = await createProject(prisma, { name: '分页项目', projectKey })
  await seedCodes(project.id, 5)

  t.after(async () => {
    await prisma.adminOperationAuditLog.deleteMany({ where: { projectId: project.id } })
    await prisma.activationCode.deleteMany({ where: { projectId: project.id } })
    await prisma.project.deleteMany({ where: { id: project.id } })
  })

  const response = await listGET(
    new NextRequest(
      `http://127.0.0.1:3000/api/admin/codes/list?page=1&pageSize=3&projectKey=${projectKey}`,
      { headers: { cookie: await createAuthCookie() } },
    ),
  )
  assert.equal(response.status, 200)

  const body = (await response.json()) as {
    success: boolean
    codes: Array<{ id: number; code: string }>
    total: number
    page: number
    pageSize: number
    totalPages: number
    statusSummary: { unused: number; inUse: number; risk: number }
    projectCoverage: number
    availableCardTypes: string[]
  }
  assert.equal(body.success, true)
  assert.equal(body.total, 5)
  assert.equal(body.page, 1)
  assert.equal(body.pageSize, 3)
  assert.equal(body.totalPages, 2)
  assert.equal(body.codes.length, 3)
  assert.equal(body.statusSummary.unused, 5)
  assert.equal(body.statusSummary.inUse, 0)
  assert.equal(body.statusSummary.risk, 0)
  assert.equal(body.projectCoverage, 1)
  assert.ok(body.availableCardTypes.length >= 0)

  // 列表页不再携带绑定历史/审计嵌套
  const sampleCode = body.codes[0] as { bindingHistories?: unknown; adminAuditLogs?: unknown }
  assert.equal(sampleCode.bindingHistories, undefined)
  assert.equal(sampleCode.adminAuditLogs, undefined)
})

test('激活码列表接口支持 status 筛选（已耗尽）', async (t) => {
  const projectKey = createUniqueProjectKey('route-status-project')
  const project = await createProject(prisma, { name: '状态筛选项目', projectKey })
  const created = await seedCodes(project.id, 2)

  // 将一个码消耗到 0
  await prisma.activationCode.update({
    where: { id: created[0].id },
    data: { isUsed: true, remainingCount: 0 },
  })

  t.after(async () => {
    await prisma.adminOperationAuditLog.deleteMany({ where: { projectId: project.id } })
    await prisma.activationCode.deleteMany({ where: { projectId: project.id } })
    await prisma.project.deleteMany({ where: { id: project.id } })
  })

  const response = await listGET(
    new NextRequest(
      `http://127.0.0.1:3000/api/admin/codes/list?status=depleted&projectKey=${projectKey}&pageSize=20`,
      { headers: { cookie: await createAuthCookie() } },
    ),
  )
  assert.equal(response.status, 200)

  const body = (await response.json()) as {
    success: boolean
    codes: Array<{ id: number }>
    total: number
    statusSummary: { unused: number; inUse: number; risk: number }
  }
  assert.equal(body.success, true)
  assert.equal(body.total, 1)
  assert.equal(body.codes[0].id, created[0].id)
  assert.equal(body.statusSummary.risk, 1)
})

test('激活码详情接口返回绑定历史与管理员审计', async (t) => {
  const projectKey = createUniqueProjectKey('route-detail-project')
  const project = await createProject(prisma, { name: '详情项目', projectKey })
  const created = await seedCodes(project.id, 1)
  const codeId = created[0].id

  t.after(async () => {
    await prisma.adminOperationAuditLog.deleteMany({ where: { projectId: project.id } })
    await prisma.activationCode.deleteMany({ where: { projectId: project.id } })
    await prisma.project.deleteMany({ where: { id: project.id } })
  })

  const response = await detailGET(
    new NextRequest(`http://127.0.0.1:3000/api/admin/codes/${codeId}`, {
      headers: { cookie: await createAuthCookie() },
    }),
    { params: { id: String(codeId) } },
  )
  assert.equal(response.status, 200)

  const body = (await response.json()) as {
    success: boolean
    activationCode: {
      id: number
      bindingHistories: unknown[]
      adminAuditLogs: unknown[]
      project: { projectKey: string } | null
    }
  }
  assert.equal(body.success, true)
  assert.equal(body.activationCode.id, codeId)
  assert.ok(Array.isArray(body.activationCode.bindingHistories))
  assert.ok(Array.isArray(body.activationCode.adminAuditLogs))
  assert.equal(body.activationCode.project?.projectKey, projectKey)
})

test('激活码详情接口对不存在 id 返回 404', async () => {
  const response = await detailGET(
    new NextRequest('http://127.0.0.1:3000/api/admin/codes/99999999', {
      headers: { cookie: await createAuthCookie() },
    }),
    { params: { id: '99999999' } },
  )
  assert.equal(response.status, 404)
})
