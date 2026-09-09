import { NextResponse, type NextRequest } from 'next/server'

import { createProtectedAdminRouteHandler } from '@/lib/admin-route-handler'
import { type AdminAuthSuccessResult } from '@/lib/admin-auth-shared'
import { resolveServerLocale, serverT } from '@/lib/i18n/server'
import { prisma } from '@/lib/db'
import {
  deleteProject,
  updateProjectDescription,
  updateProjectName,
  updateProjectRebindSettings,
  updateProjectStatus,
} from '@/lib/license-project-service'

function parseProjectId(value: string, t: (key: string) => string) {
  const id = Number(value)

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(t('api.projectIdInvalid'))
  }

  return id
}

export const PATCH = createProtectedAdminRouteHandler(
  async (
    request: NextRequest,
    authResult: AdminAuthSuccessResult,
    context: { params: { id: string } },
  ) => {
    const t = serverT(resolveServerLocale(request))
    const id = parseProjectId(context.params.id, t)
    const payload = await request.json()

    if (Object.prototype.hasOwnProperty.call(payload, 'name')) {
      const { name } = payload

      if (typeof name !== 'string') {
        return NextResponse.json(
          { success: false, message: t('api.nameMustBeString') },
          { status: 400 },
        )
      }

      const project = await updateProjectName(prisma, {
        id,
        name,
        adminUsername: authResult.payload?.username,
      })

      return NextResponse.json({
        success: true,
        message: t('project.nameUpdated'),
        project,
      })
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'description')) {
      const { description } = payload

      if (description !== null && typeof description !== 'string') {
        return NextResponse.json(
          { success: false, message: t('api.descriptionMustBeStringOrNull') },
          { status: 400 },
        )
      }

      const project = await updateProjectDescription(prisma, {
        id,
        description,
        adminUsername: authResult.payload?.username,
      })

      return NextResponse.json({
        success: true,
        message: t('project.descriptionUpdated'),
        project,
      })
    }

    if (
      Object.prototype.hasOwnProperty.call(payload, 'allowAutoRebind') ||
      Object.prototype.hasOwnProperty.call(payload, 'autoRebindCooldownMinutes') ||
      Object.prototype.hasOwnProperty.call(payload, 'autoRebindMaxCount')
    ) {
      const project = await updateProjectRebindSettings(prisma, {
        id,
        allowAutoRebind: payload.allowAutoRebind,
        autoRebindCooldownMinutes: payload.autoRebindCooldownMinutes,
        autoRebindMaxCount: payload.autoRebindMaxCount,
        adminUsername: authResult.payload?.username,
      })

      return NextResponse.json({
        success: true,
        message: t('project.rebindPolicyUpdated'),
        project,
      })
    }

    const { isEnabled } = payload

    if (typeof isEnabled !== 'boolean') {
      return NextResponse.json(
        { success: false, message: t('api.isEnabledMustBeBoolean') },
        { status: 400 },
      )
    }

    const project = await updateProjectStatus(prisma, {
      id,
      isEnabled,
      adminUsername: authResult.payload?.username,
    })

    return NextResponse.json({
      success: true,
      message: isEnabled ? '项目已启用' : t('project.disabled'),
      project,
    })
  },
  {
    logLabel: '更新项目失败',
    errorStatus: 400,
    errorMessageKey: 'project.updateFailed',
    exposeErrorMessage: true,
  },
)

export const DELETE = createProtectedAdminRouteHandler(
  async (
    _request: NextRequest,
    authResult: AdminAuthSuccessResult,
    context: { params: { id: string } },
  ) => {
    const t = serverT(resolveServerLocale(_request))
    const id = parseProjectId(context.params.id, t)
    const project = await deleteProject(prisma, {
      id,
      adminUsername: authResult.payload?.username,
    })

    return NextResponse.json({
      success: true,
      message: t('project.deleteSuccess'),
      project,
    })
  },
  {
    logLabel: '删除项目失败',
    errorStatus: 400,
    errorMessageKey: 'project.deleteFailed',
    exposeErrorMessage: true,
  },
)
