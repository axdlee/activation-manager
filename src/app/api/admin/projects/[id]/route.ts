import { NextRequest, NextResponse } from 'next/server'

import { verifyAuth, createAuthResponse } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'
import {
  deleteProject,
  updateProjectDescription,
  updateProjectName,
  updateProjectStatus,
} from '@/lib/license-project-service'

function parseProjectId(value: string) {
  const id = Number(value)

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('项目ID无效')
  }

  return id
}

export async function PATCH(
  request: NextRequest,
  context: { params: { id: string } },
) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return createAuthResponse(authResult)
    }

    const id = parseProjectId(context.params.id)
    const payload = await request.json()

    if (Object.prototype.hasOwnProperty.call(payload, 'name')) {
      const { name } = payload

      if (typeof name !== 'string') {
        return NextResponse.json(
          { success: false, message: 'name 必须为字符串' },
          { status: 400 },
        )
      }

      const project = await updateProjectName(prisma, { id, name })

      return NextResponse.json({
        success: true,
        message: '项目名称已更新',
        project,
      })
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'description')) {
      const { description } = payload

      if (description !== null && typeof description !== 'string') {
        return NextResponse.json(
          { success: false, message: 'description 必须为字符串或 null' },
          { status: 400 },
        )
      }

      const project = await updateProjectDescription(prisma, { id, description })

      return NextResponse.json({
        success: true,
        message: '项目描述已更新',
        project,
      })
    }

    const { isEnabled } = payload

    if (typeof isEnabled !== 'boolean') {
      return NextResponse.json(
        { success: false, message: 'isEnabled 必须为布尔值' },
        { status: 400 },
      )
    }

    const project = await updateProjectStatus(prisma, { id, isEnabled })

    return NextResponse.json({
      success: true,
      message: isEnabled ? '项目已启用' : '项目已停用',
      project,
    })
  } catch (error) {
    console.error('更新项目失败:', error)
    const message = error instanceof Error ? error.message : '更新项目失败'

    return NextResponse.json(
      { success: false, message },
      { status: 400 },
    )
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: { id: string } },
) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return createAuthResponse(authResult)
    }

    const id = parseProjectId(context.params.id)
    const project = await deleteProject(prisma, { id })

    return NextResponse.json({
      success: true,
      message: '项目删除成功',
      project,
    })
  } catch (error) {
    console.error('删除项目失败:', error)
    const message = error instanceof Error ? error.message : '删除项目失败'

    return NextResponse.json(
      { success: false, message },
      { status: 400 },
    )
  }
}
