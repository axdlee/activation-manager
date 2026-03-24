import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyActivationCode } from '@/lib/license-service'

export async function POST(request: NextRequest) {
  try {
    const { code, machine_id, project_key, projectKey } = await request.json()

    const result = await verifyActivationCode(prisma, {
      code,
      machineId: machine_id,
      projectKey: projectKey || project_key,
    })

    return NextResponse.json(
      {
        success: result.success,
        message: result.message,
        expires_at: 'expiresAt' in result ? result.expiresAt ?? null : null,
        remaining_count: 'remainingCount' in result ? result.remainingCount ?? null : null,
        license_mode: 'licenseMode' in result ? result.licenseMode ?? null : null,
      },
      { status: result.status }
    )

  } catch (error) {
    console.error('验证激活码时发生错误:', error)
    return NextResponse.json(
      { success: false, message: '服务器内部错误' },
      { status: 500 }
    )
  }
}
