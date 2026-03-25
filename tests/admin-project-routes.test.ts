import assert from 'node:assert/strict'
import test from 'node:test'

import { NextRequest } from 'next/server'

import * as dbModule from '../src/lib/db'
import * as projectDetailRouteModule from '../src/app/api/admin/projects/[id]/route'
import * as projectsRouteModule from '../src/app/api/admin/projects/route'
import { signToken } from '../src/lib/jwt'

const { prisma } = dbModule
const { GET, POST } = projectsRouteModule
const { PATCH, DELETE } = projectDetailRouteModule

function createUniqueProjectKey(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

async function createAuthCookie() {
  const token = await signToken({ username: 'admin', isAdmin: true })
  return `auth-token=${token}`
}

function createAdminRequest(url: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(url, init)
}

test('项目列表接口会返回已创建项目', async (t) => {
  const projectKey = createUniqueProjectKey('route-list-project')
  const project = await prisma.project.create({
    data: {
      name: '列表项目',
      projectKey,
      description: 'route list test',
      isEnabled: true,
    },
  })

  t.after(async () => {
    await prisma.project.deleteMany({
      where: {
        id: project.id,
      },
    })
    await prisma.$disconnect()
  })

  const request = createAdminRequest('http://127.0.0.1:3000/api/admin/projects', {
    headers: {
      cookie: await createAuthCookie(),
    },
  })

  const response = await GET(request)
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.success, true)
  assert.equal(Array.isArray(body.projects), true)
  assert.equal(
    body.projects.some((item: { projectKey: string }) => item.projectKey === projectKey),
    true,
  )
})

test('项目创建接口会标准化输入并返回创建结果', async (t) => {
  const projectKey = createUniqueProjectKey('route-create-project')

  t.after(async () => {
    await prisma.project.deleteMany({
      where: {
        projectKey,
      },
    })
    await prisma.$disconnect()
  })

  const request = createAdminRequest('http://127.0.0.1:3000/api/admin/projects', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: await createAuthCookie(),
    },
    body: JSON.stringify({
      name: '  新建项目  ',
      projectKey: `  ${projectKey}  `,
      description: '  项目描述  ',
    }),
  })

  const response = await POST(request)
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.deepEqual(
    {
      success: body.success,
      message: body.message,
      name: body.project.name,
      projectKey: body.project.projectKey,
      description: body.project.description,
    },
    {
      success: true,
      message: '项目创建成功',
      name: '新建项目',
      projectKey,
      description: '项目描述',
    },
  )
})

test('项目更新接口支持通过路由参数更新描述', async (t) => {
  const project = await prisma.project.create({
    data: {
      name: '待更新项目',
      projectKey: createUniqueProjectKey('route-patch-project'),
      description: 'old-description',
      isEnabled: true,
    },
  })

  t.after(async () => {
    await prisma.project.deleteMany({
      where: {
        id: project.id,
      },
    })
    await prisma.$disconnect()
  })

  const request = createAdminRequest(`http://127.0.0.1:3000/api/admin/projects/${project.id}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      cookie: await createAuthCookie(),
    },
    body: JSON.stringify({
      description: '  new-description  ',
    }),
  })

  const response = await PATCH(request, { params: { id: String(project.id) } })
  const body = await response.json()
  const updatedProject = await prisma.project.findUniqueOrThrow({
    where: {
      id: project.id,
    },
  })

  assert.equal(response.status, 200)
  assert.deepEqual(
    {
      success: body.success,
      message: body.message,
      description: body.project.description,
    },
    {
      success: true,
      message: '项目描述已更新',
      description: 'new-description',
    },
  )
  assert.equal(updatedProject.description, 'new-description')
})

test('项目删除接口会删除空项目', async (t) => {
  const project = await prisma.project.create({
    data: {
      name: '待删除项目',
      projectKey: createUniqueProjectKey('route-delete-project'),
      description: null,
      isEnabled: true,
    },
  })

  t.after(async () => {
    await prisma.project.deleteMany({
      where: {
        id: project.id,
      },
    })
    await prisma.$disconnect()
  })

  const request = createAdminRequest(`http://127.0.0.1:3000/api/admin/projects/${project.id}`, {
    method: 'DELETE',
    headers: {
      cookie: await createAuthCookie(),
    },
  })

  const response = await DELETE(request, { params: { id: String(project.id) } })
  const body = await response.json()
  const deletedProject = await prisma.project.findUnique({
    where: {
      id: project.id,
    },
  })

  assert.equal(response.status, 200)
  assert.deepEqual(
    {
      success: body.success,
      message: body.message,
      projectId: body.project.id,
    },
    {
      success: true,
      message: '项目删除成功',
      projectId: project.id,
    },
  )
  assert.equal(deletedProject, null)
})
