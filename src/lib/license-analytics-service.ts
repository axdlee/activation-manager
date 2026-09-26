import { findProjectByProjectKey, type DbClient } from './license-project-service'

type GetLicenseConsumptionTrendInput = {
  projectKey?: string
  days?: number
  granularity?: 'day' | 'week' | 'month'
  now?: string | Date
}

type LicenseConsumptionTrendGranularity = 'day' | 'week' | 'month'

type ActivationCodeStats = {
  total: number
  used: number
  expired: number
  active: number
}

type ProjectStats = {
  id: number
  name: string
  projectKey: string
  isEnabled: boolean
  totalCodes: number
  usedCodes: number
  expiredCodes: number
  activeCodes: number
  countRemainingTotal: number
  countConsumedTotal: number
}

type LicenseConsumptionTrendPoint = {
  date: string
  label: string
  count: number
}

type LicenseConsumptionTrendComparison = {
  previousRangeStart: string
  previousRangeEnd: string
  previousTotalConsumptions: number
  changeCount: number
  changePercentage: number | null
}

type LicenseConsumptionTrend = {
  days: number
  granularity: LicenseConsumptionTrendGranularity
  totalConsumptions: number
  maxBucketConsumptions: number
  maxDailyConsumptions: number
  comparison: LicenseConsumptionTrendComparison
  points: LicenseConsumptionTrendPoint[]
}

type ActivationCodeAggregateRow = {
  projectId: number
  isUsed: boolean
  licenseMode: string
  usedAt: Date | null
  expiresAt: Date | null
  validDays: number | null
  remainingCount: number | null
  totalCount: number | null
  consumedCount: number
}

/** 行级过期/活跃判定所需的最小字段集（窄拉查询的返回形状） */
type ExpirableCodeRow = Pick<
  ActivationCodeAggregateRow,
  'projectId' | 'isUsed' | 'licenseMode' | 'usedAt' | 'expiresAt' | 'validDays'
>

type ProjectCodeStatsAggregates = {
  totalCodes: number
  usedCodes: number
  expiredCodes: number
  activeCodes: number
  countRemainingTotal: number
  countConsumedTotal: number
}

type ProjectStatsRow = {
  id: number
  name: string
  projectKey: string
  isEnabled: boolean
  totalCodes: number
  usedCodes: number
  expiredCodes: number
  activeCodes: number
  countRemainingTotal: number
  countConsumedTotal: number
}

function normalizeOptionalDateInput(value?: string | Date) {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  const normalizedValue = String(value).trim()
  if (!normalizedValue) {
    return null
  }

  const parsedDate = new Date(normalizedValue)
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate
}

function normalizeTrendDays(value?: number) {
  if (value === undefined) {
    return 7
  }

  if (!Number.isInteger(value) || value < 1 || value > 90) {
    throw new Error('days 必须是 1-90 之间的整数')
  }

  return value
}

function normalizeTrendGranularity(
  value?: string,
): LicenseConsumptionTrendGranularity {
  if (!value) {
    return 'day'
  }

  if (value !== 'day' && value !== 'week' && value !== 'month') {
    throw new Error('granularity 仅支持 day、week、month')
  }

  return value
}

function getUtcDayStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function getUtcDayEnd(date: Date) {
  return new Date(getUtcDayStart(date).getTime() + 24 * 60 * 60 * 1000 - 1)
}

function formatUtcDateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function formatUtcDateLabel(date: Date) {
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')

  return `${month}-${day}`
}

function getUtcWeekStart(date: Date) {
  const start = getUtcDayStart(date)
  const day = start.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  start.setUTCDate(start.getUTCDate() + diff)
  return start
}

function getUtcMonthStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function addUtcDays(date: Date, days: number) {
  const nextDate = new Date(date)
  nextDate.setUTCDate(nextDate.getUTCDate() + days)
  return nextDate
}

function addUtcMonths(date: Date, months: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1))
}

function getTrendBucketStart(date: Date, granularity: LicenseConsumptionTrendGranularity) {
  if (granularity === 'week') {
    return getUtcWeekStart(date)
  }

  if (granularity === 'month') {
    return getUtcMonthStart(date)
  }

  return getUtcDayStart(date)
}

function getNextTrendBucketStart(date: Date, granularity: LicenseConsumptionTrendGranularity) {
  if (granularity === 'week') {
    return addUtcDays(date, 7)
  }

  if (granularity === 'month') {
    return addUtcMonths(date, 1)
  }

  return addUtcDays(date, 1)
}

function formatTrendBucketLabel(date: Date, granularity: LicenseConsumptionTrendGranularity) {
  if (granularity === 'week') {
    const endDate = addUtcDays(date, 6)
    return `${formatUtcDateLabel(date)}~${formatUtcDateLabel(endDate)}`
  }

  if (granularity === 'month') {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
  }

  return formatUtcDateLabel(date)
}

// ---------- 方言无关聚合（Prisma groupBy/count 聚合 + 窄拉行级判定） ----------
// 历史版本用 SQLite 方言原生 SQL（"isUsed" = 1、createdAt/1000、strftime/unixepoch），
// PostgreSQL 下看板统计/项目统计/消费趋势全部报错；v2.10.0 改为 findMany 取
// 最小字段集 + JS 聚合。但看板/项目统计仍会把全表激活码拉进内存，码量增长后
// 每次打开看板都是一次全表扫描 + 全量对象分配。v2.11.0 改为：
// - 可在 DB 内表达的口径全部下沉为 groupBy/_sum/_count 聚合（同参数兼容 SQLite/PG）
// - 只有「usedAt + validDays 组合到期」这一 DB 方言无法统一表达的行级判定
//   仍需拉行，且 where 收窄到「已用、非次数码、带到期线索」的子集
// 口径与全表行级聚合逐行等价（钉住测试：license-stats-aggregation.test.ts；
// 真实库回归：license-analytics-dialect-free.test.ts）。

const CODE_STATS_BASE_WHERE = { deletedAt: null } as const

const DAY_MILLIS = 24 * 60 * 60 * 1000

/** 实际到期时间（毫秒）：COUNT 码无到期；TIME 码优先 usedAt+validDays，回退 expiresAt */
function resolveActualExpiresAtMillis(code: ExpirableCodeRow): number | null {
  if (code.licenseMode === 'COUNT') {
    return null
  }
  if (code.usedAt !== null && code.validDays !== null) {
    return code.usedAt.getTime() + code.validDays * DAY_MILLIS
  }
  if (code.expiresAt !== null) {
    return code.expiresAt.getTime()
  }
  return null
}

function isExpiredCode(code: ExpirableCodeRow, nowMillis: number): boolean {
  const actualExpiresAt = resolveActualExpiresAtMillis(code)
  return (
    code.isUsed &&
    code.licenseMode !== 'COUNT' &&
    actualExpiresAt !== null &&
    actualExpiresAt < nowMillis
  )
}

function isActiveCode(code: ExpirableCodeRow, nowMillis: number): boolean {
  if (code.licenseMode === 'COUNT') {
    // 窄拉集已排除 COUNT 码（其 active 口径 = 行级剩余 > 0，由 activeCountGroups
    // 聚合判定），此处仅为类型完备防护
    return false
  }
  if (!code.isUsed) {
    return true
  }
  const actualExpiresAt = resolveActualExpiresAtMillis(code)
  if (actualExpiresAt === null) {
    return true
  }
  return actualExpiresAt >= nowMillis
}

/**
 * 按项目聚合激活码统计：DB 内 groupBy/_sum/_count + 窄拉行级到期判定。
 * 划分与全表行级聚合逐行等价：
 * - 未用（任意模式）→ active（G1 的 isUsed=false 组）
 * - COUNT 码 → active 当且仅当行级剩余 > 0（G5；isUsed 与否不影响口径），
 *   永不计 expired；剩余合计 = ΣremainingCount(非空) + ΣtotalCount(remaining 空组，
 *   行级回退 remainingCount ?? totalCount ?? 0 的分组等价拆分)
 * - 非 COUNT 已用且无任何到期线索（usedAt/expiresAt 全空）→ 恒 active（G6）
 * - 非 COUNT 已用且带到期线索（usedAt 或 expiresAt 非空）→ 窄拉行级判定
 */
async function aggregateCodeStatsByProject(
  client: DbClient,
  nowMillis: number,
): Promise<Map<number, ProjectCodeStatsAggregates>> {
  const [
    usageGroups,
    unusedNonCountGroups,
    remainingSumGroups,
    remainingFallbackSumGroups,
    consumedSumGroups,
    activeCountGroups,
    noExpiryUsedGroups,
    expirableRows,
  ] = await Promise.all([
    client.activationCode.groupBy({
      by: ['projectId', 'isUsed'],
      where: CODE_STATS_BASE_WHERE,
      _count: { _all: true },
    }),
    client.activationCode.groupBy({
      by: ['projectId'],
      where: { ...CODE_STATS_BASE_WHERE, isUsed: false, licenseMode: { not: 'COUNT' } },
      _count: { _all: true },
    }),
    client.activationCode.groupBy({
      by: ['projectId'],
      where: { ...CODE_STATS_BASE_WHERE, licenseMode: 'COUNT', remainingCount: { not: null } },
      _sum: { remainingCount: true },
    }),
    client.activationCode.groupBy({
      by: ['projectId'],
      where: { ...CODE_STATS_BASE_WHERE, licenseMode: 'COUNT', remainingCount: null },
      _sum: { totalCount: true },
    }),
    client.activationCode.groupBy({
      by: ['projectId'],
      where: { ...CODE_STATS_BASE_WHERE, licenseMode: 'COUNT' },
      _sum: { consumedCount: true },
    }),
    client.activationCode.groupBy({
      by: ['projectId'],
      where: {
        ...CODE_STATS_BASE_WHERE,
        licenseMode: 'COUNT',
        OR: [
          { remainingCount: { gt: 0 } },
          { AND: [{ remainingCount: null }, { totalCount: { gt: 0 } }] },
        ],
      },
      _count: { _all: true },
    }),
    client.activationCode.groupBy({
      by: ['projectId'],
      where: {
        ...CODE_STATS_BASE_WHERE,
        isUsed: true,
        licenseMode: { not: 'COUNT' },
        usedAt: null,
        expiresAt: null,
      },
      _count: { _all: true },
    }),
    client.activationCode.findMany({
      where: {
        ...CODE_STATS_BASE_WHERE,
        isUsed: true,
        licenseMode: { not: 'COUNT' },
        OR: [{ usedAt: { not: null } }, { expiresAt: { not: null } }],
      },
      select: {
        projectId: true,
        isUsed: true,
        licenseMode: true,
        usedAt: true,
        expiresAt: true,
        validDays: true,
      },
    }),
  ])

  const buckets = new Map<number, ProjectCodeStatsAggregates>()

  function bucketOf(projectId: number): ProjectCodeStatsAggregates {
    let bucket = buckets.get(projectId)
    if (!bucket) {
      bucket = {
        totalCodes: 0,
        usedCodes: 0,
        expiredCodes: 0,
        activeCodes: 0,
        countRemainingTotal: 0,
        countConsumedTotal: 0,
      }
      buckets.set(projectId, bucket)
    }
    return bucket
  }

  for (const group of usageGroups) {
    const bucket = bucketOf(group.projectId)
    bucket.totalCodes += group._count._all
    if (group.isUsed) {
      bucket.usedCodes += group._count._all
    }
    // 未用行的 active 计数由 unusedNonCountGroups（非 COUNT）与
    // activeCountGroups（COUNT，行级剩余 > 0）分别承担，避免 COUNT
    // 未用行在 G1 与 G5 重复计入
  }

  for (const group of unusedNonCountGroups) {
    bucketOf(group.projectId).activeCodes += group._count._all
  }

  for (const group of remainingSumGroups) {
    bucketOf(group.projectId).countRemainingTotal += group._sum.remainingCount ?? 0
  }
  for (const group of remainingFallbackSumGroups) {
    bucketOf(group.projectId).countRemainingTotal += group._sum.totalCount ?? 0
  }
  for (const group of consumedSumGroups) {
    bucketOf(group.projectId).countConsumedTotal += group._sum.consumedCount ?? 0
  }
  for (const group of activeCountGroups) {
    bucketOf(group.projectId).activeCodes += group._count._all
  }
  for (const group of noExpiryUsedGroups) {
    bucketOf(group.projectId).activeCodes += group._count._all
  }

  for (const row of expirableRows) {
    const bucket = bucketOf(row.projectId)
    if (isExpiredCode(row, nowMillis)) {
      bucket.expiredCodes += 1
    }
    if (isActiveCode(row, nowMillis)) {
      bucket.activeCodes += 1
    }
  }

  return buckets
}

async function listProjectStatsRows(client: DbClient, now: Date): Promise<ProjectStatsRow[]> {
  const [projects, statsByProject] = await Promise.all([
    client.project.findMany({
      select: { id: true, name: true, projectKey: true, isEnabled: true, createdAt: true },
      orderBy: [{ isEnabled: 'desc' }, { createdAt: 'asc' }],
    }),
    aggregateCodeStatsByProject(client, now.getTime()),
  ])

  return projects.map((project) => {
    const stats = statsByProject.get(project.id) ?? {
      totalCodes: 0,
      usedCodes: 0,
      expiredCodes: 0,
      activeCodes: 0,
      countRemainingTotal: 0,
      countConsumedTotal: 0,
    }
    return {
      id: project.id,
      name: project.name,
      projectKey: project.projectKey,
      isEnabled: project.isEnabled,
      totalCodes: stats.totalCodes,
      usedCodes: stats.usedCodes,
      expiredCodes: stats.expiredCodes,
      activeCodes: stats.activeCodes,
      countRemainingTotal: stats.countRemainingTotal,
      countConsumedTotal: stats.countConsumedTotal,
    }
  })
}

function buildLicenseConsumptionWhereClause(input: {
  projectId?: number
  createdFrom: Date
  createdTo: Date
}) {
  return {
    createdAt: { gte: input.createdFrom, lte: input.createdTo },
    ...(input.projectId !== undefined ? { activationCode: { projectId: input.projectId } } : {}),
  }
}

/** 按粒度把消费记录分桶（UTC 语义：日=当日 0 点、周=周一、月=当月 1 号），返回桶键→计数 */
async function listLicenseConsumptionTrendBuckets(
  client: DbClient,
  input: {
    projectId?: number
    rangeStart: Date
    rangeEnd: Date
    granularity: LicenseConsumptionTrendGranularity
  },
): Promise<Map<string, number>> {
  const baseWhere = buildLicenseConsumptionWhereClause({
    projectId: input.projectId,
    createdFrom: input.rangeStart,
    createdTo: input.rangeEnd,
  })

  // 先按桶边界生成区间，再逐桶 count（count 下沉 DB，不再把窗口内记录拉进内存；
  // LicenseConsumption 有 [createdAt, id] 索引，桶数受 days 上限约束）
  const bucketRanges: Array<{ key: string; start: Date; end: Date }> = []
  let cursor = getTrendBucketStart(input.rangeStart, input.granularity)
  while (cursor <= input.rangeEnd) {
    const bucketStart = new Date(cursor)
    const bucketEnd = getNextTrendBucketStart(bucketStart, input.granularity)
    bucketRanges.push({ key: formatUtcDateKey(bucketStart), start: bucketStart, end: bucketEnd })
    cursor = bucketEnd
  }

  const counts = await Promise.all(
    bucketRanges.map((range) =>
      client.licenseConsumption.count({
        where: {
          AND: [baseWhere, { createdAt: { gte: range.start, lt: range.end } }],
        },
      }),
    ),
  )

  const bucketCountMap = new Map<string, number>()
  bucketRanges.forEach((range, index) => {
    bucketCountMap.set(range.key, counts[index])
  })
  return bucketCountMap
}

async function countPreviousRangeConsumptions(
  client: DbClient,
  input: {
    projectId?: number
    rangeStart: Date
    rangeEnd: Date
  },
): Promise<number> {
  return client.licenseConsumption.count({
    where: buildLicenseConsumptionWhereClause({
      projectId: input.projectId,
      createdFrom: input.rangeStart,
      createdTo: input.rangeEnd,
    }),
  })
}

export async function getLicenseConsumptionTrend(
  client: DbClient,
  input?: GetLicenseConsumptionTrendInput,
): Promise<LicenseConsumptionTrend> {
  const days = normalizeTrendDays(input?.days)
  const granularity = normalizeTrendGranularity(input?.granularity)
  const now = input?.now === undefined ? new Date() : normalizeOptionalDateInput(input.now)

  if (input?.now !== undefined && !now) {
    throw new Error('now 时间格式不正确')
  }

  const project = await findProjectByProjectKey(client, input?.projectKey)
  const rangeEnd = getUtcDayEnd(now ?? new Date())
  const rangeStart = getUtcDayStart(now ?? new Date())
  rangeStart.setUTCDate(rangeStart.getUTCDate() - days + 1)
  const previousRangeEnd = new Date(rangeStart.getTime() - 1)
  const previousRangeStart = getUtcDayStart(previousRangeEnd)
  previousRangeStart.setUTCDate(previousRangeStart.getUTCDate() - days + 1)

  const [bucketCountMap, previousTotalConsumptions] = await Promise.all([
    listLicenseConsumptionTrendBuckets(client, {
      projectId: project?.id,
      rangeStart,
      rangeEnd,
      granularity,
    }),
    countPreviousRangeConsumptions(client, {
      projectId: project?.id,
      rangeStart: previousRangeStart,
      rangeEnd: previousRangeEnd,
    }),
  ])

  const points: LicenseConsumptionTrendPoint[] = []
  let cursor = getTrendBucketStart(rangeStart, granularity)

  while (cursor <= rangeEnd) {
    const dateKey = formatUtcDateKey(cursor)

    points.push({
      date: dateKey,
      label: formatTrendBucketLabel(cursor, granularity),
      count: bucketCountMap.get(dateKey) ?? 0,
    })

    cursor = getNextTrendBucketStart(cursor, granularity)
  }

  const totalConsumptions = points.reduce((sum, point) => sum + point.count, 0)
  const maxBucketConsumptions = points.reduce((max, point) => Math.max(max, point.count), 0)
  const changeCount = totalConsumptions - previousTotalConsumptions
  const changePercentage =
    previousTotalConsumptions === 0
      ? totalConsumptions === 0
        ? 0
        : null
      : Number((changeCount / previousTotalConsumptions * 100).toFixed(1))

  return {
    days,
    granularity,
    totalConsumptions,
    maxBucketConsumptions,
    maxDailyConsumptions: maxBucketConsumptions,
    comparison: {
      previousRangeStart: formatUtcDateKey(previousRangeStart),
      previousRangeEnd: formatUtcDateKey(previousRangeEnd),
      previousTotalConsumptions,
      changeCount,
      changePercentage,
    },
    points,
  }
}

export async function getActivationCodeStats(client: DbClient): Promise<ActivationCodeStats> {
  const statsByProject = await aggregateCodeStatsByProject(client, Date.now())

  let total = 0
  let used = 0
  let expired = 0
  let active = 0
  for (const stats of statsByProject.values()) {
    total += stats.totalCodes
    used += stats.usedCodes
    expired += stats.expiredCodes
    active += stats.activeCodes
  }

  return { total, used, expired, active }
}

export async function listProjectStats(client: DbClient): Promise<ProjectStats[]> {
  const rows = await listProjectStatsRows(client, new Date())

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    projectKey: row.projectKey,
    isEnabled: row.isEnabled,
    totalCodes: row.totalCodes,
    usedCodes: row.usedCodes,
    expiredCodes: row.expiredCodes,
    activeCodes: row.activeCodes,
    countRemainingTotal: row.countRemainingTotal,
    countConsumedTotal: row.countConsumedTotal,
  }))
}
