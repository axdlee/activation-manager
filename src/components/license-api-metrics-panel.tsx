'use client'

import React, { useEffect, useState } from 'react'

type LicenseApiMetricPoint = {
  path: string
  total: number
  success: number
  failure: number
  rateLimited: number
  avgDurationMs: number
}

type MetricsSummary = {
  total: number
  success: number
  failure: number
  rateLimited: number
  successRate: number
  windowSeconds: number
  points: LicenseApiMetricPoint[]
}

const pathLabelMap: Record<string, string> = {
  activate: '激活',
  status: '状态查询',
  consume: '消费扣次',
  verify: '旧版验证',
  other: '其他',
}

export function LicenseApiMetricsPanel({ panelClassName }: { panelClassName: string }) {
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/admin/metrics/license-api')
      const data = (await response.json()) as { success: boolean; metrics?: MetricsSummary }
      if (!data.success || !data.metrics) {
        setError('指标读取失败')
        return
      }
      setMetrics(data.metrics)
    } catch {
      setError('指标读取失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <section className={`${panelClassName} p-6`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-sm border border-brand-500/20 bg-brand-500/10 px-2.5 py-1 text-xs font-medium text-brand-400">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
            License API 运行指标
          </div>
          <h3 className="mt-3 text-xl font-semibold text-ink-50">近 {Math.round((metrics?.windowSeconds ?? 300) / 60)} 分钟请求概览</h3>
          <p className="mt-1 text-sm leading-6 text-ink-500">
            激活 / 状态 / 消费接口的请求量、成功率与平均耗时（内存窗口，重启清零）。
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-md border border-surface-200 bg-surface-100 px-3 py-1.5 text-xs text-ink-300 transition hover:text-ink-50"
        >
          刷新
        </button>
      </div>

      {loading && !metrics ? (
        <div className="mt-5 py-6 text-center text-sm text-ink-500">正在加载指标…</div>
      ) : error ? (
        <div className="mt-5 rounded-md border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
          {error}
        </div>
      ) : metrics ? (
        <div className="mt-5 space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['总请求', metrics.total],
              ['成功率', `${metrics.successRate}%`],
              ['失败', metrics.failure],
              ['被限流', metrics.rateLimited],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg border border-surface-200 bg-surface-50 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.18em] text-ink-500">{label}</div>
                <div className="mt-1 text-xl font-semibold text-ink-50">{value}</div>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-surface-200 text-xs uppercase tracking-[0.18em] text-ink-500">
                  <th className="py-2 pr-4">接口</th>
                  <th className="py-2 pr-4">请求数</th>
                  <th className="py-2 pr-4">成功</th>
                  <th className="py-2 pr-4">失败</th>
                  <th className="py-2 pr-4">限流</th>
                  <th className="py-2 pr-4">平均耗时</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200">
                {metrics.points.map((point) => (
                  <tr key={point.path}>
                    <td className="py-3 pr-4 font-medium text-ink-50">
                      {pathLabelMap[point.path] ?? point.path}
                    </td>
                    <td className="py-3 pr-4 text-ink-300">{point.total}</td>
                    <td className="py-3 pr-4 text-emerald-400">{point.success}</td>
                    <td className="py-3 pr-4 text-rose-400">{point.failure}</td>
                    <td className="py-3 pr-4 text-amber-400">{point.rateLimited}</td>
                    <td className="py-3 pr-4 text-ink-300">{point.avgDurationMs}ms</td>
                  </tr>
                ))}
                {metrics.points.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-ink-500">
                      近窗口内暂无请求
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  )
}
