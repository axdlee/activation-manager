import { NextResponse, type NextRequest } from 'next/server'

import { createProtectedAdminRouteHandler } from '@/lib/admin-route-handler'
import { prisma } from '@/lib/db'
import {
  createProject,
  ensureDefaultProjectRecord,
  listProjects,
} from '@/lib/license-project-service'

export const GET = createProtectedAdminRouteHandler(
  async () => {
    await ensureDefaultProjectRecord(prisma)
    const projects = await listProjects(prisma)

    return NextResponse.json({
      success: true,
      projects,
    })
  },
  {
    logLabel: '获取项目列表失败',
    errorStatus: 500,
    errorMessage: '获取项目列表失败',
  },
)

export const POST = createProtectedAdminRouteHandler(
  async (request: NextRequest, authResult) => {
    const {
      name,
      projectKey,
      description,
      allowAutoRebind,
      autoRebindCooldownMinutes,
      autoRebindMaxCount,
    } =
      await request.json()

    const project = await createProject(prisma, {
      name,
      projectKey,
      description,
      allowAutoRebind,
      autoRebindCooldownMinutes,
      autoRebindMaxCount,
      adminUsername: authResult.payload?.username,
    })

    return NextResponse.json({
      success: true,
      message: '项目创建成功',
      project,
    })
  },
  {
    logLabel: '创建项目失败',
    errorStatus: 400,
    errorMessage: '创建项目失败',
    exposeErrorMessage: true,
  },
)
