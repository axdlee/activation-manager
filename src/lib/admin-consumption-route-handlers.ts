import { PrismaClient } from '@prisma/client'

import { buildConsumptionTrendComparisonSeries } from './consumption-trend-comparison'
import { getVisibleConsumptionTrendPoints } from './consumption-trend-display'
import { prisma } from './db'
import { getLicenseConsumptionTrend } from './license-analytics-service'
import {
  listLicenseConsumptions,
  listLicenseConsumptionsPage,
} from './license-consumption-service'

type LicenseConsumptionCsvLog = {
  requestId: string
  machineId: string
  remainingCountAfter: number
  createdAt: Date | string
  activationCode: {
    code: string
    licenseMode: string
    project: {
      name: string
      projectKey: string
    }
  }
}

type LicenseConsumptionTrendCsvPoint = {
  date: string
  label: string
  count: number
}

type LicenseConsumptionTrendCsv = {
  days: number
  granularity?: string
  points: LicenseConsumptionTrendCsvPoint[]
}

type LicenseConsumptionTrendComparisonCsvPoint = {
  date: string
  label: string
  primaryCount: number
  secondaryCount: number
}

type LicenseConsumptionTrendComparisonCsv = {
  granularity?: string
  points: LicenseConsumptionTrendComparisonCsvPoint[]
}

function escapeCsvValue(value: string | number) {
  const normalizedValue = String(value)

  if (/[",\n]/.test(normalizedValue)) {
    return `"${normalizedValue.replace(/"/g, '""')}"`
  }

  return normalizedValue
}

function createCsvRow(values: Array<string | number>) {
  return values.map(escapeCsvValue).join(',')
}

function getLicenseModeDisplay(mode: string) {
  return mode === 'COUNT' ? '次数型' : '时间型'
}

async function findProjectNameByKey(client: PrismaClient, projectKey?: string) {
  if (!projectKey) {
    return null
  }

  return client.project.findUnique({
    where: {
      projectKey,
    },
    select: {
      name: true,
    },
  })
}

function buildLicenseConsumptionCsv(logs: LicenseConsumptionCsvLog[]) {
  const rows = [
    createCsvRow(['项目', '项目标识', '激活码', 'requestId', '机器ID', '授权类型', '剩余次数', '消费时间']),
    ...logs.map((log) =>
      createCsvRow([
        log.activationCode.project.name,
        log.activationCode.project.projectKey,
        log.activationCode.code,
        log.requestId,
        log.machineId,
        getLicenseModeDisplay(log.activationCode.licenseMode),
        log.remainingCountAfter,
        new Date(log.createdAt).toISOString(),
      ]),
    ),
  ]

  return `\uFEFF${rows.join('\n')}`
}

function buildLicenseConsumptionTrendCsv(
  trend: LicenseConsumptionTrendCsv,
  projectKey: string,
  projectName: string,
) {
  const rows = [
    createCsvRow(['项目', '项目标识', '统计粒度', '时间范围', '消费次数']),
    ...trend.points.map((point) =>
      createCsvRow([
        projectName,
        projectKey,
        trend.granularity || 'day',
        point.label,
        point.count,
      ]),
    ),
  ]

  return `\uFEFF${rows.join('\n')}`
}

function buildLicenseConsumptionTrendComparisonCsv(
  trend: LicenseConsumptionTrendComparisonCsv,
  projectKey: string,
  projectName: string,
  compareProjectKey: string,
  compareProjectName: string,
) {
  const rows = [
    createCsvRow([
      '项目',
      '项目标识',
      '对比项目',
      '对比项目标识',
      '统计粒度',
      '时间范围',
      '当前项目消费次数',
      '对比项目消费次数',
      '差值',
    ]),
    ...trend.points.map((point) =>
      createCsvRow([
        projectName,
        projectKey,
        compareProjectName,
        compareProjectKey,
        trend.granularity || 'day',
        point.label,
        point.primaryCount,
        point.secondaryCount,
        point.primaryCount - point.secondaryCount,
      ]),
    ),
  ]

  return `\uFEFF${rows.join('\n')}`
}

export function readLicenseConsumptionFilters(request: Request) {
  const requestUrl = new URL(request.url)

  return {
    projectKey: requestUrl.searchParams.get('projectKey') || undefined,
    keyword: requestUrl.searchParams.get('keyword') || undefined,
    createdFrom: requestUrl.searchParams.get('createdFrom') || undefined,
    createdTo: requestUrl.searchParams.get('createdTo') || undefined,
  }
}

export function readLicenseConsumptionPagination(request: Request) {
  const requestUrl = new URL(request.url)
  const rawPage = requestUrl.searchParams.get('page')
  const rawPageSize = requestUrl.searchParams.get('pageSize')

  return {
    page: rawPage ? Number(rawPage) : undefined,
    pageSize: rawPageSize ? Number(rawPageSize) : undefined,
  }
}

export async function handleListLicenseConsumptionsRequest(
  request: Request,
  client: PrismaClient = prisma,
) {
  const { logs, pagination } = await listLicenseConsumptionsPage(client, {
    ...readLicenseConsumptionFilters(request),
    ...readLicenseConsumptionPagination(request),
  })

  return Response.json({
    success: true,
    logs,
    pagination,
  })
}

export function readLicenseConsumptionTrendFilters(request: Request) {
  const requestUrl = new URL(request.url)
  const rawDays = requestUrl.searchParams.get('days')
  const rawGranularity = requestUrl.searchParams.get('granularity')
  const rawHideZeroBuckets = requestUrl.searchParams.get('hideZeroBuckets')
  const granularity =
    rawGranularity === 'day' || rawGranularity === 'week' || rawGranularity === 'month'
      ? (rawGranularity as 'day' | 'week' | 'month')
      : undefined

  return {
    projectKey: requestUrl.searchParams.get('projectKey') || undefined,
    compareProjectKey: requestUrl.searchParams.get('compareProjectKey') || undefined,
    days: rawDays ? Number(rawDays) : undefined,
    granularity,
    now: requestUrl.searchParams.get('now') || undefined,
    hideZeroBuckets: rawHideZeroBuckets === 'true',
  }
}

export async function handleListLicenseConsumptionTrendRequest(
  request: Request,
  client: PrismaClient = prisma,
) {
  const { hideZeroBuckets: _hideZeroBuckets, ...filters } = readLicenseConsumptionTrendFilters(request)
  const trend = await getLicenseConsumptionTrend(client, filters)

  return Response.json({
    success: true,
    trend,
  })
}

export async function handleExportLicenseConsumptionTrendRequest(
  request: Request,
  client: PrismaClient = prisma,
) {
  const { hideZeroBuckets, compareProjectKey, ...filters } = readLicenseConsumptionTrendFilters(request)
  const [trend, project] = await Promise.all([
    getLicenseConsumptionTrend(client, filters),
    findProjectNameByKey(client, filters.projectKey),
  ])
  const shouldCompare = Boolean(compareProjectKey && compareProjectKey !== filters.projectKey)
  const filename = `license_consumption_trend_${new Date().toISOString().slice(0, 10)}.csv`
  let csvContent = buildLicenseConsumptionTrendCsv(
    {
      ...trend,
      points: getVisibleConsumptionTrendPoints(trend.points, {
        hideZeroBuckets,
      }).points,
    },
    filters.projectKey || 'all',
    project?.name || '全部项目',
  )

  if (shouldCompare && compareProjectKey) {
    const [compareTrend, compareProject] = await Promise.all([
      getLicenseConsumptionTrend(client, {
        ...filters,
        projectKey: compareProjectKey,
      }),
      findProjectNameByKey(client, compareProjectKey),
    ])

    csvContent = buildLicenseConsumptionTrendComparisonCsv(
      {
        granularity: trend.granularity,
        points: buildConsumptionTrendComparisonSeries(trend.points, compareTrend.points, {
          hideZeroBuckets,
        }).points,
      },
      filters.projectKey || 'all',
      project?.name || '全部项目',
      compareProjectKey,
      compareProject?.name || compareProjectKey,
    )
  }

  return new Response(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

export async function handleExportLicenseConsumptionsRequest(
  request: Request,
  client: PrismaClient = prisma,
) {
  const logs = await listLicenseConsumptions(client, readLicenseConsumptionFilters(request))
  const filename = `license_consumptions_${new Date().toISOString().slice(0, 10)}.csv`

  return new Response(buildLicenseConsumptionCsv(logs), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
