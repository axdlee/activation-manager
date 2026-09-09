import { NextResponse, type NextRequest } from 'next/server'

import { createProtectedAdminRouteHandler } from '@/lib/admin-route-handler'
import { resolveServerLocale, serverT } from '@/lib/i18n/server'
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
    errorMessageKey: 'project.listFailed',
  },
)

export const POST = createProtectedAdminRouteHandler(
  async (request: NextRequest, authResult) => {
    const t = serverT(resolveServerLocale(request))
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
      message: t('project.createSuccess'),
      project,
    })
  },
  {
    logLabel: '创建项目失败',
    errorStatus: 400,
    errorMessageKey: 'project.createFailed',
    exposeErrorMessage: true,
  },
)
