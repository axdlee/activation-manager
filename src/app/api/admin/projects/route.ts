import { NextRequest, NextResponse } from 'next/server'

import { verifyAuth, createAuthResponse } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'
import { createProject, ensureDefaultProjectRecord, listProjects } from '@/lib/license-service'

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return createAuthResponse(authResult.error || '认证失败', 401)
    }

    await ensureDefaultProjectRecord(prisma)
    const projects = await listProjects(prisma)

    return NextResponse.json({
      success: true,
      projects,
    })
  } catch (error) {
    console.error('获取项目列表失败:', error)
    return NextResponse.json(
      { success: false, message: '获取项目列表失败' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return createAuthResponse(authResult.error || '认证失败', 401)
    }

    const { name, projectKey, description } = await request.json()

    const project = await createProject(prisma, {
      name,
      projectKey,
      description,
    })

    return NextResponse.json({
      success: true,
      message: '项目创建成功',
      project,
    })
  } catch (error) {
    console.error('创建项目失败:', error)
    const message = error instanceof Error ? error.message : '创建项目失败'
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    )
  }
}
