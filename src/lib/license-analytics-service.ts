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

// ---------- 方言无关聚合（Prisma 查询 + JS 聚合） ----------
// 历史版本用 SQLite 方言原生 SQL（"isUsed" = 1、createdAt/1000、strftime/unixepoch），
// PostgreSQL 下看板统计/项目统计/消费趋势全部报错；改为 Prisma findMany 取
// 最小字段集 + JS 聚合，同一代码路径同时兼容 SQLite 与 PostgreSQL，
// 并统一过滤 deletedAt（软删除码不再计入统计，低危评审项）。

const ACTIVATION_CODE_AGGREGATE_SELECT = {
  projectId: true,
  isUsed: true,
  licenseMode: true,
  usedAt: true,
  expiresAt: true,
  validDays: true,
  remainingCount: true,
  totalCount: true,
  consumedCount: true,
} as const

const DAY_MILLIS = 24 * 60 * 60 * 1000

async function listAggregateActivationCodes(client: DbClient): Promise<ActivationCodeAggregateRow[]> {
  return client.activationCode.findMany({
    where: { deletedAt: null },
    select: ACTIVATION_CODE_AGGREGATE_SELECT,
  })
}

/** 实际到期时间（毫秒）：COUNT 码无到期；TIME 码优先 usedAt+validDays，回退 expiresAt */
function resolveActualExpiresAtMillis(code: ActivationCodeAggregateRow): number | null {
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

/** 次数码剩余次数：remainingCount 缺失回退 totalCount，再回退 0 */
function getRemainingCount(code: ActivationCodeAggregateRow): number {
  return code.remainingCount ?? code.totalCount ?? 0
}

function isExpiredCode(code: ActivationCodeAggregateRow, nowMillis: number): boolean {
  const actualExpiresAt = resolveActualExpiresAtMillis(code)
  return (
    code.isUsed &&
    code.licenseMode !== 'COUNT' &&
    actualExpiresAt !== null &&
    actualExpiresAt < nowMillis
  )
}

function isActiveCode(code: ActivationCodeAggregateRow, nowMillis: number): boolean {
  if (code.licenseMode === 'COUNT') {
    return getRemainingCount(code) > 0
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

function computeActivationCodeStats(codes: ActivationCodeAggregateRow[], nowMillis: number) {
  let usedCodes = 0
  let expiredCodes = 0
  let activeCodes = 0
  for (const code of codes) {
    if (code.isUsed) {
      usedCodes += 1
    }
    if (isExpiredCode(code, nowMillis)) {
      expiredCodes += 1
    }
    if (isActiveCode(code, nowMillis)) {
      activeCodes += 1
    }
  }
  return {
    totalCodes: codes.length,
    usedCodes,
    expiredCodes,
    activeCodes,
  }
}

async function listProjectStatsRows(client: DbClient, now: Date): Promise<ProjectStatsRow[]> {
  const nowMillis = now.getTime()
  const [projects, codes] = await Promise.all([
    client.project.findMany({
      select: { id: true, name: true, projectKey: true, isEnabled: true, createdAt: true },
      orderBy: [{ isEnabled: 'desc' }, { createdAt: 'asc' }],
    }),
    listAggregateActivationCodes(client),
  ])

  const codesByProject = new Map<number, ActivationCodeAggregateRow[]>()
  for (const code of codes) {
    const bucket = codesByProject.get(code.projectId)
    if (bucket) {
      bucket.push(code)
    } else {
      codesByProject.set(code.projectId, [code])
    }
  }

  return projects.map((project) => {
    const projectCodes = codesByProject.get(project.id) ?? []
    const stats = computeActivationCodeStats(projectCodes, nowMillis)
    let countRemainingTotal = 0
    let countConsumedTotal = 0
    for (const code of projectCodes) {
      if (code.licenseMode === 'COUNT') {
        countRemainingTotal += getRemainingCount(code)
        countConsumedTotal += code.consumedCount
      }
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
      countRemainingTotal,
      countConsumedTotal,
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
  const rows = await client.licenseConsumption.findMany({
    where: buildLicenseConsumptionWhereClause({
      projectId: input.projectId,
      createdFrom: input.rangeStart,
      createdTo: input.rangeEnd,
    }),
    select: { createdAt: true },
  })

  const bucketCountMap = new Map<string, number>()
  for (const row of rows) {
    const bucketKey = formatUtcDateKey(getTrendBucketStart(row.createdAt, input.granularity))
    bucketCountMap.set(bucketKey, (bucketCountMap.get(bucketKey) ?? 0) + 1)
  }
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
  const codes = await listAggregateActivationCodes(client)
  const stats = computeActivationCodeStats(codes, Date.now())

  return {
    total: stats.totalCodes,
    used: stats.usedCodes,
    expired: stats.expiredCodes,
    active: stats.activeCodes,
  }
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
