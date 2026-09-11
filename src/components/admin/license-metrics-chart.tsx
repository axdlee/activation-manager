'use client'

/**
 * LicenseMetricsChart — 各 License API 路径请求量横向条形图（Recharts）
 *
 * 数据：/api/admin/metrics/license-api 返回的按路径聚合桶（5 分钟滚动窗口）。
 * 空数据时显示占位提示。
 */

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  Cell,
} from 'recharts'
import { useI18n } from '@/lib/i18n/i18n-provider'

export type LicenseMetricPoint = {
  path: string
  total: number
  success: number
  failure: number
  rateLimited: number
  avgDurationMs: number
}

const PATH_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--success))',
  'hsl(var(--warning))',
  'hsl(var(--destructive))',
  'hsl(262 60% 60%)',
  'hsl(190 70% 45%)',
]

export function LicenseMetricsChart({
  points,
  height = 240,
}: {
  points: LicenseMetricPoint[]
  height?: number
}) {
  const { t } = useI18n()

  const data = points
    .filter((p) => p.total > 0)
    .map((p) => ({
      path: p.path
        .replace('/api/license/', '')
        .replace('/api/verify', 'verify'),
      total: p.total,
      success: p.success,
      color: PATH_COLORS[points.indexOf(p) % PATH_COLORS.length],
    }))

  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground"
        style={{ height }}
      >
        {t('metrics.chartEmpty', '暂无请求数据——激活/状态/消费接口被调用后将在这里绘制分布')}
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            stroke="hsl(var(--border))"
          />
          <YAxis
            type="category"
            dataKey="path"
            width={90}
            tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
            stroke="hsl(var(--border))"
          />
          <RechartsTooltip
            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
            contentStyle={{
              background: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8,
              fontSize: 12,
              color: 'hsl(var(--popover-foreground))',
            }}
          />
          <Bar dataKey="total" name={t('metrics.chartTotal', '总请求')} radius={[0, 6, 6, 0]}>
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
