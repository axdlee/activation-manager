import { NextResponse } from 'next/server'

import { createProtectedAdminRouteHandler } from '@/lib/admin-route-handler'
import { getLicenseApiMetricsSummary } from '@/lib/license-api-metrics'

/**
 * License API 指标（近 5 分钟滑动窗口）：
 * 请求量 / 成功率 / 失败数 / 限流数 / 平均耗时（按路径维度）。
 */
export const GET = createProtectedAdminRouteHandler(
  async () => {
    const metrics = getLicenseApiMetricsSummary()
    return NextResponse.json({ success: true, metrics })
  },
  { logLabel: 'license-api-metrics' },
)
