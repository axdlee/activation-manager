/**
 * License API 轻量指标（内存滑动窗口）。
 *
 * 设计原则：
 * - 内存计数，不落库：热路径零 IO，避免每次激活/消费都写库
 * - 滑动窗口保留近期数据（默认 5 分钟），可随时读取
 * - 按路径维度聚合：activate / status / consume / legacy
 */

export type LicenseApiMetricPoint = {
  path: string
  total: number
  success: number
  failure: number
  rateLimited: number
  avgDurationMs: number
  windowStartMs: number
  windowEndMs: number
}

type PathMetric = {
  total: number
  success: number
  failure: number
  rateLimited: number
  durationSumMs: number
  timestamps: number[]
}

const DEFAULT_WINDOW_MS = 5 * 60 * 1000
const metrics = new Map<string, PathMetric>()
let windowStartMs = Date.now()

export function resetLicenseApiMetrics() {
  metrics.clear()
  windowStartMs = Date.now()
}

function normalizePath(pathname: string) {
  if (pathname.includes('/api/license/activate')) return 'activate'
  if (pathname.includes('/api/license/consume')) return 'consume'
  if (pathname.includes('/api/license/status')) return 'status'
  if (pathname.includes('/api/verify')) return 'verify'
  return 'other'
}

function rollWindowIfNeeded(now: number) {
  if (now - windowStartMs > DEFAULT_WINDOW_MS) {
    metrics.clear()
    windowStartMs = now
  }
}

export function recordLicenseApiRequest(params: {
  pathname: string
  success: boolean
  rateLimited?: boolean
  durationMs: number
  now?: number
}) {
  const now = params.now ?? Date.now()
  rollWindowIfNeeded(now)

  const path = normalizePath(params.pathname)
  const record = metrics.get(path) ?? {
    total: 0,
    success: 0,
    failure: 0,
    rateLimited: 0,
    durationSumMs: 0,
    timestamps: [],
  }

  record.total += 1
  if (params.rateLimited) {
    record.rateLimited += 1
  } else if (params.success) {
    record.success += 1
  } else {
    record.failure += 1
  }
  record.durationSumMs += params.durationMs
  record.timestamps.push(now)

  metrics.set(path, record)
}

export function getLicenseApiMetrics(now: number = Date.now()): LicenseApiMetricPoint[] {
  rollWindowIfNeeded(now)

  return Array.from(metrics.entries())
    .map(([path, record]) => ({
      path,
      total: record.total,
      success: record.success,
      failure: record.failure,
      rateLimited: record.rateLimited,
      avgDurationMs: record.total > 0 ? Math.round(record.durationSumMs / record.total) : 0,
      windowStartMs,
      windowEndMs: now,
    }))
    .sort((a, b) => b.total - a.total)
}

export function getLicenseApiMetricsSummary(now: number = Date.now()) {
  const points = getLicenseApiMetrics(now)
  const total = points.reduce((sum, point) => sum + point.total, 0)
  const success = points.reduce((sum, point) => sum + point.success, 0)
  const failure = points.reduce((sum, point) => sum + point.failure, 0)
  const rateLimited = points.reduce((sum, point) => sum + point.rateLimited, 0)

  return {
    total,
    success,
    failure,
    rateLimited,
    successRate: total > 0 ? Math.round((success / total) * 1000) / 10 : 0,
    windowSeconds: DEFAULT_WINDOW_MS / 1000,
    points,
  }
}
