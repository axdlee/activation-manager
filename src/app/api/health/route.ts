import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * 轻量健康检查端点：
 * - 供 Docker HEALTHCHECK / 反向代理 / 编排系统探测
 * - 只做最小数据库连通性检查，避免重负载
 * - 不返回任何敏感信息
 */
export async function GET() {
  try {
    // 最小查询：验证数据库连接可用
    await prisma.$queryRaw`SELECT 1`

    return NextResponse.json(
      {
        status: 'ok',
        service: 'activation-manager',
        time: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    )
  } catch {
    return NextResponse.json(
      {
        status: 'error',
        service: 'activation-manager',
        time: new Date().toISOString(),
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    )
  }
}
