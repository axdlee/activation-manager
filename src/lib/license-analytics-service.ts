import { Prisma } from '@prisma/client'

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

type LicenseConsumptionTrendBucketRow = {
  bucketDate: string
  consumptionCount: bigint | number | string
}

type LicenseConsumptionTrendTotalRow = {
  totalConsumptions: bigint | number | string
}

type ActivationCodeStatsRow = {
  totalCodes: bigint | number | string | null
  usedCodes: bigint | number | string | null
  expiredCodes: bigint | number | string | null
  activeCodes: bigint | number | string | null
}

type ProjectStatsRow = {
  id: number
  name: string
  projectKey: string
  isEnabled: boolean | number
  totalCodes: bigint | number | string | null
  usedCodes: bigint | number | string | null
  expiredCodes: bigint | number | string | null
  activeCodes: bigint | number | string | null
  countRemainingTotal: bigint | number | string | null
  countConsumedTotal: bigint | number | string | null
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

function normalizeAggregateCount(value: bigint | number | string | null | undefined) {
  if (typeof value === 'number') {
    return value
  }

  if (typeof value === 'bigint') {
    return Number(value)
  }

  if (typeof value === 'string' && value.trim()) {
    return Number(value)
  }

  return 0
}

function normalizeSqliteBoolean(value: boolean | number) {
  if (typeof value === 'boolean') {
    return value
  }

  return value !== 0
}

function getLicenseConsumptionCreatedAtUnixSecondsSql() {
  return Prisma.sql`CAST("lc"."createdAt" / 1000 AS INTEGER)`
}

function getActivationCodeUsedAtUnixSecondsSql() {
  return Prisma.sql`CAST("ac"."usedAt" / 1000 AS INTEGER)`
}

function getActivationCodeExpiresAtUnixSecondsSql() {
  return Prisma.sql`CAST("ac"."expiresAt" / 1000 AS INTEGER)`
}

function getActivationCodeActualExpiresAtUnixSecondsSql() {
  const usedAtUnixSecondsSql = getActivationCodeUsedAtUnixSecondsSql()
  const expiresAtUnixSecondsSql = getActivationCodeExpiresAtUnixSecondsSql()

  return Prisma.sql`
    CASE
      WHEN "ac"."licenseMode" = 'COUNT' THEN NULL
      WHEN "ac"."usedAt" IS NOT NULL AND "ac"."validDays" IS NOT NULL
        THEN ${usedAtUnixSecondsSql} + ("ac"."validDays" * 86400)
      WHEN "ac"."expiresAt" IS NOT NULL
        THEN ${expiresAtUnixSecondsSql}
      ELSE NULL
    END
  `
}

function getActivationCodeRemainingCountSql() {
  return Prisma.sql`
    CASE
      WHEN "ac"."licenseMode" = 'COUNT' THEN COALESCE("ac"."remainingCount", "ac"."totalCount", 0)
      ELSE 0
    END
  `
}

function getActivationCodeExpiredFlagSql(nowUnixSeconds: number) {
  const actualExpiresAtUnixSecondsSql = getActivationCodeActualExpiresAtUnixSecondsSql()

  return Prisma.sql`
    CASE
      WHEN "ac"."id" IS NOT NULL
        AND "ac"."isUsed" = 1
        AND "ac"."licenseMode" != 'COUNT'
        AND ${actualExpiresAtUnixSecondsSql} IS NOT NULL
        AND ${actualExpiresAtUnixSecondsSql} < ${nowUnixSeconds}
      THEN 1
      ELSE 0
    END
  `
}

function getActivationCodeActiveFlagSql(nowUnixSeconds: number) {
  const actualExpiresAtUnixSecondsSql = getActivationCodeActualExpiresAtUnixSecondsSql()
  const remainingCountSql = getActivationCodeRemainingCountSql()

  return Prisma.sql`
    CASE
      WHEN "ac"."id" IS NULL THEN 0
      WHEN "ac"."licenseMode" = 'COUNT'
        THEN CASE WHEN ${remainingCountSql} > 0 THEN 1 ELSE 0 END
      WHEN "ac"."isUsed" = 0 THEN 1
      WHEN ${actualExpiresAtUnixSecondsSql} IS NULL THEN 1
      WHEN ${actualExpiresAtUnixSecondsSql} >= ${nowUnixSeconds} THEN 1
      ELSE 0
    END
  `
}

async function getActivationCodeStatsRow(client: DbClient, now: Date) {
  const nowUnixSeconds = Math.floor(now.getTime() / 1000)
  const expiredFlagSql = getActivationCodeExpiredFlagSql(nowUnixSeconds)
  const activeFlagSql = getActivationCodeActiveFlagSql(nowUnixSeconds)

  const [row] = await client.$queryRaw<ActivationCodeStatsRow[]>(Prisma.sql`
    SELECT
      COUNT(*) AS "totalCodes",
      COALESCE(SUM(CASE WHEN "ac"."isUsed" = 1 THEN 1 ELSE 0 END), 0) AS "usedCodes",
      COALESCE(SUM(${expiredFlagSql}), 0) AS "expiredCodes",
      COALESCE(SUM(${activeFlagSql}), 0) AS "activeCodes"
    FROM "activation_codes" AS "ac"
  `)

  return row
}

async function listProjectStatsRows(client: DbClient, now: Date) {
  const nowUnixSeconds = Math.floor(now.getTime() / 1000)
  const expiredFlagSql = getActivationCodeExpiredFlagSql(nowUnixSeconds)
  const activeFlagSql = getActivationCodeActiveFlagSql(nowUnixSeconds)
  const remainingCountSql = getActivationCodeRemainingCountSql()

  return client.$queryRaw<ProjectStatsRow[]>(Prisma.sql`
    SELECT
      "p"."id" AS "id",
      "p"."name" AS "name",
      "p"."projectKey" AS "projectKey",
      "p"."isEnabled" AS "isEnabled",
      COUNT("ac"."id") AS "totalCodes",
      COALESCE(SUM(CASE WHEN "ac"."isUsed" = 1 THEN 1 ELSE 0 END), 0) AS "usedCodes",
      COALESCE(SUM(${expiredFlagSql}), 0) AS "expiredCodes",
      COALESCE(SUM(${activeFlagSql}), 0) AS "activeCodes",
      COALESCE(SUM(${remainingCountSql}), 0) AS "countRemainingTotal",
      COALESCE(SUM(CASE WHEN "ac"."licenseMode" = 'COUNT' THEN "ac"."consumedCount" ELSE 0 END), 0) AS "countConsumedTotal"
    FROM "projects" AS "p"
    LEFT JOIN "activation_codes" AS "ac"
      ON "ac"."projectId" = "p"."id"
    GROUP BY "p"."id", "p"."name", "p"."projectKey", "p"."isEnabled", "p"."createdAt"
    ORDER BY "p"."isEnabled" DESC, "p"."createdAt" ASC
  `)
}

function getTrendBucketSqlExpression(granularity: LicenseConsumptionTrendGranularity) {
  const createdAtUnixSecondsSql = getLicenseConsumptionCreatedAtUnixSecondsSql()

  if (granularity === 'week') {
    return Prisma.sql`
      date(
        ${createdAtUnixSecondsSql},
        'unixepoch',
        '-' || ((CAST(strftime('%w', ${createdAtUnixSecondsSql}, 'unixepoch') AS INTEGER) + 6) % 7) || ' days'
      )
    `
  }

  if (granularity === 'month') {
    return Prisma.sql`strftime('%Y-%m-01', ${createdAtUnixSecondsSql}, 'unixepoch')`
  }

  return Prisma.sql`date(${createdAtUnixSecondsSql}, 'unixepoch')`
}

function buildLicenseConsumptionTrendWhereSql(input: {
  projectId?: number
  createdFrom: Date
  createdTo: Date
}) {
  let whereSql = Prisma.sql`"lc"."createdAt" >= ${input.createdFrom}
    AND "lc"."createdAt" <= ${input.createdTo}`

  if (input.projectId !== undefined) {
    whereSql = Prisma.sql`${whereSql} AND "ac"."projectId" = ${input.projectId}`
  }

  return Prisma.sql`WHERE ${whereSql}`
}

async function listLicenseConsumptionTrendBuckets(
  client: DbClient,
  input: {
    projectId?: number
    rangeStart: Date
    rangeEnd: Date
    granularity: LicenseConsumptionTrendGranularity
  },
) {
  const bucketSql = getTrendBucketSqlExpression(input.granularity)

  return client.$queryRaw<LicenseConsumptionTrendBucketRow[]>(Prisma.sql`
    SELECT
      ${bucketSql} AS "bucketDate",
      COUNT(*) AS "consumptionCount"
    FROM "license_consumptions" AS "lc"
    INNER JOIN "activation_codes" AS "ac"
      ON "ac"."id" = "lc"."activationCodeId"
    ${buildLicenseConsumptionTrendWhereSql({
      projectId: input.projectId,
      createdFrom: input.rangeStart,
      createdTo: input.rangeEnd,
    })}
    GROUP BY ${bucketSql}
    ORDER BY ${bucketSql} ASC
  `)
}

async function countPreviousRangeConsumptions(
  client: DbClient,
  input: {
    projectId?: number
    rangeStart: Date
    rangeEnd: Date
  },
) {
  const [row] = await client.$queryRaw<LicenseConsumptionTrendTotalRow[]>(Prisma.sql`
    SELECT
      COUNT(*) AS "totalConsumptions"
    FROM "license_consumptions" AS "lc"
    INNER JOIN "activation_codes" AS "ac"
      ON "ac"."id" = "lc"."activationCodeId"
    ${buildLicenseConsumptionTrendWhereSql({
      projectId: input.projectId,
      createdFrom: input.rangeStart,
      createdTo: input.rangeEnd,
    })}
  `)

  return normalizeAggregateCount(row?.totalConsumptions)
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

  const bucketCountMap = new Map<string, number>()
  const [bucketRows, previousTotalConsumptions] = await Promise.all([
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

  bucketRows.forEach((row) => {
    bucketCountMap.set(row.bucketDate, normalizeAggregateCount(row.consumptionCount))
  })

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
  const row = await getActivationCodeStatsRow(client, new Date())

  return {
    total: normalizeAggregateCount(row?.totalCodes),
    used: normalizeAggregateCount(row?.usedCodes),
    expired: normalizeAggregateCount(row?.expiredCodes),
    active: normalizeAggregateCount(row?.activeCodes),
  }
}

export async function listProjectStats(client: DbClient): Promise<ProjectStats[]> {
  const rows = await listProjectStatsRows(client, new Date())

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    projectKey: row.projectKey,
    isEnabled: normalizeSqliteBoolean(row.isEnabled),
    totalCodes: normalizeAggregateCount(row.totalCodes),
    usedCodes: normalizeAggregateCount(row.usedCodes),
    expiredCodes: normalizeAggregateCount(row.expiredCodes),
    activeCodes: normalizeAggregateCount(row.activeCodes),
    countRemainingTotal: normalizeAggregateCount(row.countRemainingTotal),
    countConsumedTotal: normalizeAggregateCount(row.countConsumedTotal),
  }))
}
