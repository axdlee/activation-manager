import crypto from 'crypto'

import { Prisma, PrismaClient } from '@prisma/client'

import { DEFAULT_PROJECT_KEY, DEFAULT_PROJECT_NAME } from './dev-bootstrap'
import {
  getActualExpiresAt,
  isCodeActive,
  getRemainingCount,
  isCodeExpired,
  type LicenseModeValue,
} from './license-status'

type DbClient = PrismaClient | Prisma.TransactionClient

type CreateProjectInput = {
  name: string
  projectKey: string
  description?: string | null
}

type UpdateProjectStatusInput = {
  id: number
  isEnabled: boolean
}

type UpdateProjectNameInput = {
  id: number
  name: string
}

type UpdateProjectDescriptionInput = {
  id: number
  description?: string | null
}

type DeleteProjectInput = {
  id: number
}

type GenerateActivationCodesInput = {
  projectKey?: string
  amount: number
  licenseMode: LicenseModeValue
  validDays?: number | null
  totalCount?: number | null
  cardType?: string | null
}

type LicenseActionInput = {
  projectKey?: string
  code: string
  machineId: string
}

type ConsumeLicenseInput = LicenseActionInput & {
  requestId?: string
}

type LicenseStatusInput = LicenseActionInput

type ListLicenseConsumptionsInput = {
  projectKey?: string
  keyword?: string
  createdFrom?: string | Date
  createdTo?: string | Date
}

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

type LicenseResult = {
  success: boolean
  message: string
  status: number
  licenseMode?: string
  expiresAt?: Date | null
  remainingCount?: number | null
  isActivated?: boolean
  valid?: boolean
  idempotent?: boolean
}

function normalizeProjectKey(projectKey?: string) {
  return (projectKey || DEFAULT_PROJECT_KEY).trim()
}

function normalizeCode(code: string) {
  return String(code || '').trim()
}

function normalizeMachineId(machineId: string) {
  return String(machineId || '').trim()
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

function generateActivationCode() {
  return crypto.randomBytes(8).toString('hex').toUpperCase()
}

async function resolveProject(client: DbClient, projectKey?: string) {
  const normalizedProjectKey = normalizeProjectKey(projectKey)
  const project = await client.project.findUnique({
    where: {
      projectKey: normalizedProjectKey,
    },
  })

  if (!project) {
    throw new Error(`项目不存在: ${normalizedProjectKey}`)
  }

  if (!project.isEnabled) {
    throw new Error(`项目已停用: ${normalizedProjectKey}`)
  }

  return project
}

async function getProjectById(client: DbClient, id: number) {
  return client.project.findUnique({
    where: {
      id,
    },
  })
}

async function findProjectByProjectKey(client: DbClient, projectKey?: string) {
  const normalizedProjectKey = projectKey?.trim()

  if (!normalizedProjectKey) {
    return null
  }

  const project = await client.project.findUnique({
    where: {
      projectKey: normalizedProjectKey,
    },
    select: {
      id: true,
    },
  })

  if (!project) {
    throw new Error(`项目不存在: ${normalizedProjectKey}`)
  }

  return project
}

async function ensureUniqueCode(client: DbClient) {
  while (true) {
    const code = generateActivationCode()
    const existingCode = await client.activationCode.findUnique({
      where: {
        code,
      },
    })

    if (!existingCode) {
      return code
    }
  }
}

function buildReusableConflictMessage(existingCode: {
  code: string
  licenseMode: string
  remainingCount: number | null
}) {
  if (existingCode.licenseMode === 'COUNT') {
    return `该设备已绑定激活码: ${existingCode.code}，请先用完剩余次数（剩余 ${existingCode.remainingCount ?? 0} 次）`
  }

  return `该设备已激活过激活码: ${existingCode.code}，同一项目下每台设备只能使用一个有效激活码`
}

function canReuseProjectBinding(existingCode: {
  licenseMode: string
  remainingCount: number | null
  totalCount?: number | null
  isUsed: boolean
  usedAt: Date | null
  expiresAt: Date | null
  validDays: number | null
}) {
  if (existingCode.licenseMode === 'COUNT') {
    return (getRemainingCount(existingCode) ?? 0) <= 0
  }

  return isCodeExpired(existingCode)
}

async function findProjectActivationCode(
  client: DbClient,
  projectId: number,
  code: string,
) {
  const activationCode = await client.activationCode.findUnique({
    where: {
      code,
    },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          projectKey: true,
        },
      },
    },
  })

  if (!activationCode || activationCode.projectId !== projectId) {
    return null
  }

  return activationCode
}

async function findMachineBinding(
  client: DbClient,
  projectId: number,
  machineId: string,
) {
  return client.activationCode.findFirst({
    where: {
      projectId,
      usedBy: machineId,
      isUsed: true,
    },
    orderBy: {
      usedAt: 'desc',
    },
  })
}

function createMissingParamsResult(): LicenseResult {
  return {
    success: false,
    message: '激活码和机器ID不能为空',
    status: 400,
  }
}

function createActivationSuccessResult(code: {
  licenseMode: string
  validDays: number | null
  usedAt: Date | null
  expiresAt: Date | null
  remainingCount: number | null
  isUsed: boolean
}, message: string): LicenseResult {
  return {
    success: true,
    message,
    status: 200,
    licenseMode: code.licenseMode,
    expiresAt: getActualExpiresAt(code),
    remainingCount: getRemainingCount(code),
    isActivated: code.isUsed,
    valid:
      code.licenseMode === 'COUNT'
        ? (getRemainingCount(code) ?? 0) > 0
        : !isCodeExpired(code),
  }
}

function calculateActivationCodeStats(
  codes: Array<{
    isUsed: boolean
    expiresAt: Date | null
    usedAt: Date | null
    validDays: number | null
    licenseMode: string
    remainingCount: number | null
    totalCount: number | null
  }>,
): ActivationCodeStats {
  const now = new Date()

  return {
    total: codes.length,
    used: codes.filter((code) => code.isUsed).length,
    expired: codes.filter((code) => {
      if (!code.isUsed || code.licenseMode === 'COUNT') {
        return false
      }

      const actualExpiresAt = getActualExpiresAt(code)
      return Boolean(actualExpiresAt && actualExpiresAt < now)
    }).length,
    active: codes.filter((code) => isCodeActive(code, now)).length,
  }
}

export async function ensureDefaultProjectRecord(client: DbClient) {
  return client.project.upsert({
    where: {
      projectKey: DEFAULT_PROJECT_KEY,
    },
    update: {
      name: DEFAULT_PROJECT_NAME,
      isEnabled: true,
    },
    create: {
      name: DEFAULT_PROJECT_NAME,
      projectKey: DEFAULT_PROJECT_KEY,
      description: '系统兼容默认项目',
      isEnabled: true,
    },
  })
}

export async function listProjects(client: DbClient) {
  return client.project.findMany({
    orderBy: [{ isEnabled: 'desc' }, { createdAt: 'asc' }],
  })
}

export async function createProject(client: DbClient, input: CreateProjectInput) {
  const name = input.name.trim()
  const projectKey = input.projectKey.trim()
  const description = input.description?.trim() || null

  if (!name) {
    throw new Error('项目名称不能为空')
  }

  if (!projectKey) {
    throw new Error('项目标识不能为空')
  }

  return client.project.create({
    data: {
      name,
      projectKey,
      description,
      isEnabled: true,
    },
  })
}

export async function updateProjectStatus(client: DbClient, input: UpdateProjectStatusInput) {
  const project = await getProjectById(client, input.id)

  if (!project) {
    throw new Error('项目不存在')
  }

  if (project.projectKey === DEFAULT_PROJECT_KEY && !input.isEnabled) {
    throw new Error('默认项目不允许停用')
  }

  return client.project.update({
    where: {
      id: project.id,
    },
    data: {
      isEnabled: input.isEnabled,
    },
  })
}

export async function updateProjectName(client: DbClient, input: UpdateProjectNameInput) {
  const project = await getProjectById(client, input.id)

  if (!project) {
    throw new Error('项目不存在')
  }

  if (project.projectKey === DEFAULT_PROJECT_KEY) {
    throw new Error('默认项目不允许修改名称')
  }

  const name = input.name.trim()

  if (!name) {
    throw new Error('项目名称不能为空')
  }

  return client.project.update({
    where: {
      id: project.id,
    },
    data: {
      name,
    },
  })
}

export async function updateProjectDescription(client: DbClient, input: UpdateProjectDescriptionInput) {
  const project = await getProjectById(client, input.id)

  if (!project) {
    throw new Error('项目不存在')
  }

  return client.project.update({
    where: {
      id: project.id,
    },
    data: {
      description: input.description?.trim() || null,
    },
  })
}

export async function deleteProject(client: DbClient, input: DeleteProjectInput) {
  const project = await getProjectById(client, input.id)

  if (!project) {
    throw new Error('项目不存在')
  }

  if (project.projectKey === DEFAULT_PROJECT_KEY) {
    throw new Error('默认项目不允许删除')
  }

  const codeCount = await client.activationCode.count({
    where: {
      projectId: project.id,
    },
  })

  if (codeCount > 0) {
    throw new Error('项目下仍有激活码，无法删除')
  }

  return client.project.delete({
    where: {
      id: project.id,
    },
  })
}

export async function generateActivationCodes(client: DbClient, input: GenerateActivationCodesInput) {
  const project = await resolveProject(client, input.projectKey)
  const amount = Number(input.amount)
  const licenseMode = input.licenseMode
  const validDays = input.validDays ?? null
  const totalCount = input.totalCount ?? null

  if (!amount || amount < 1 || amount > 100) {
    throw new Error('生成数量必须在1-100之间')
  }

  if (licenseMode === 'TIME') {
    if (validDays !== null && validDays <= 0) {
      throw new Error('时间型激活码的有效天数必须大于0')
    }
  } else if (licenseMode === 'COUNT') {
    if (!totalCount || totalCount <= 0) {
      throw new Error('次数型激活码的总次数必须大于0')
    }
  } else {
    throw new Error('不支持的授权类型')
  }

  const codes = []

  for (let index = 0; index < amount; index += 1) {
    const code = await ensureUniqueCode(client)
    const activationCode = await client.activationCode.create({
      data: {
        code,
        projectId: project.id,
        licenseMode,
        validDays: licenseMode === 'TIME' ? validDays : null,
        cardType: input.cardType || (licenseMode === 'COUNT' && totalCount ? `${totalCount}次卡` : null),
        totalCount: licenseMode === 'COUNT' ? totalCount : null,
        remainingCount: licenseMode === 'COUNT' ? totalCount : null,
        expiresAt: null,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            projectKey: true,
          },
        },
      },
    })

    codes.push(activationCode)
  }

  return codes
}

export async function listLicenseConsumptions(
  client: DbClient,
  input?: ListLicenseConsumptionsInput,
) {
  const normalizedProjectKey = input?.projectKey?.trim()
  const normalizedKeyword = input?.keyword?.trim().toLowerCase()
  const createdFrom = normalizeOptionalDateInput(input?.createdFrom)
  const createdTo = normalizeOptionalDateInput(input?.createdTo)
  const project = await findProjectByProjectKey(client, normalizedProjectKey)

  if (input?.createdFrom && !createdFrom) {
    throw new Error('createdFrom 时间格式不正确')
  }

  if (input?.createdTo && !createdTo) {
    throw new Error('createdTo 时间格式不正确')
  }

  if (createdFrom && createdTo && createdFrom > createdTo) {
    throw new Error('createdFrom 不能晚于 createdTo')
  }

  const where: Prisma.LicenseConsumptionWhereInput = {}

  if (project) {
    where.activationCode = {
      projectId: project.id,
    }
  }

  if (createdFrom || createdTo) {
    where.createdAt = {
      ...(createdFrom ? { gte: createdFrom } : {}),
      ...(createdTo ? { lte: createdTo } : {}),
    }
  }

  const logs = await client.licenseConsumption.findMany({
    where: Object.keys(where).length > 0 ? where : undefined,
    include: {
      activationCode: {
        include: {
          project: {
            select: {
              id: true,
              name: true,
              projectKey: true,
            },
          },
        },
      },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  })

  if (!normalizedKeyword) {
    return logs
  }

  return logs.filter((log) => {
    const searchableFields = [
      log.requestId,
      log.machineId,
      log.activationCode.code,
    ]

    return searchableFields.some((field) => field.toLowerCase().includes(normalizedKeyword))
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

  const logs = await client.licenseConsumption.findMany({
    where: {
      ...(project
        ? {
            activationCode: {
              projectId: project.id,
            },
          }
        : {}),
      createdAt: {
        gte: previousRangeStart,
        lte: rangeEnd,
      },
    },
    select: {
      createdAt: true,
    },
  })

  const bucketCountMap = new Map<string, number>()
  let previousTotalConsumptions = 0

  logs.forEach((log) => {
    if (log.createdAt < rangeStart) {
      previousTotalConsumptions += 1
      return
    }

    const bucketStart = getTrendBucketStart(log.createdAt, granularity)
    const dateKey = formatUtcDateKey(bucketStart)
    bucketCountMap.set(dateKey, (bucketCountMap.get(dateKey) ?? 0) + 1)
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
  const codes = await client.activationCode.findMany({
    select: {
      isUsed: true,
      expiresAt: true,
      usedAt: true,
      validDays: true,
      licenseMode: true,
      remainingCount: true,
      totalCount: true,
    },
  })

  return calculateActivationCodeStats(codes)
}

export async function listProjectStats(client: DbClient): Promise<ProjectStats[]> {
  const projects = await client.project.findMany({
    include: {
      codes: {
        select: {
          isUsed: true,
          expiresAt: true,
          usedAt: true,
          validDays: true,
          licenseMode: true,
          remainingCount: true,
          totalCount: true,
          consumedCount: true,
        },
      },
    },
    orderBy: [{ isEnabled: 'desc' }, { createdAt: 'asc' }],
  })

  return projects.map((project) => {
    const codeStats = calculateActivationCodeStats(project.codes)

    return {
      id: project.id,
      name: project.name,
      projectKey: project.projectKey,
      isEnabled: project.isEnabled,
      totalCodes: codeStats.total,
      usedCodes: codeStats.used,
      expiredCodes: codeStats.expired,
      activeCodes: codeStats.active,
      countRemainingTotal: project.codes
        .filter((code) => code.licenseMode === 'COUNT')
        .reduce((sum, code) => sum + (getRemainingCount(code) ?? 0), 0),
      countConsumedTotal: project.codes
        .filter((code) => code.licenseMode === 'COUNT')
        .reduce((sum, code) => sum + code.consumedCount, 0),
    }
  })
}

export async function getLicenseStatus(client: PrismaClient, input: LicenseStatusInput): Promise<LicenseResult> {
  const code = normalizeCode(input.code)
  const machineId = normalizeMachineId(input.machineId)
  if (!code || !machineId) {
    return createMissingParamsResult()
  }

  const project = await resolveProject(client, input.projectKey)
  const activationCode = await findProjectActivationCode(client, project.id, code)

  if (!activationCode) {
    return {
      success: false,
      message: '激活码不存在',
      status: 404,
    }
  }

  if (activationCode.usedBy && activationCode.usedBy !== machineId) {
    return {
      success: false,
      message: '激活码已被其他设备使用',
      status: 400,
    }
  }

  return {
    success: true,
    message: '获取激活码状态成功',
    status: 200,
    licenseMode: activationCode.licenseMode,
    expiresAt: getActualExpiresAt(activationCode),
    remainingCount: getRemainingCount(activationCode),
    isActivated: activationCode.isUsed,
    valid:
      activationCode.licenseMode === 'COUNT'
        ? (getRemainingCount(activationCode) ?? 0) > 0
        : !activationCode.isUsed || !isCodeExpired(activationCode),
  }
}

export async function activateLicense(client: PrismaClient, input: LicenseActionInput): Promise<LicenseResult> {
  const code = normalizeCode(input.code)
  const machineId = normalizeMachineId(input.machineId)
  if (!code || !machineId) {
    return createMissingParamsResult()
  }

  const project = await resolveProject(client, input.projectKey)

  return client.$transaction(async (tx) => {
    const existingBinding = await findMachineBinding(tx, project.id, machineId)

    if (existingBinding && existingBinding.code !== code && !canReuseProjectBinding(existingBinding)) {
      return {
        success: false,
        message: buildReusableConflictMessage(existingBinding),
        status: 400,
      }
    }

    const activationCode = await findProjectActivationCode(tx, project.id, code)

    if (!activationCode) {
      return {
        success: false,
        message: '激活码不存在',
        status: 404,
      }
    }

    if (activationCode.usedBy && activationCode.usedBy !== machineId) {
      return {
        success: false,
        message: '激活码已被其他设备使用',
        status: 400,
      }
    }

    if (activationCode.licenseMode === 'COUNT') {
      const remainingCount = getRemainingCount(activationCode)
      if (!remainingCount || remainingCount <= 0) {
        return {
          success: false,
          message: '激活码可用次数已用完',
          status: 400,
        }
      }

      if (activationCode.isUsed && activationCode.usedBy === machineId) {
        return createActivationSuccessResult(activationCode, '激活码已激活')
      }

      const now = new Date()
      const updatedCode = await tx.activationCode.update({
        where: {
          id: activationCode.id,
        },
        data: {
          isUsed: true,
          usedAt: activationCode.usedAt ?? now,
          usedBy: machineId,
        },
      })

      return createActivationSuccessResult(updatedCode, '激活码激活成功')
    }

    if (activationCode.isUsed && activationCode.usedBy === machineId) {
      if (isCodeExpired(activationCode)) {
        return {
          success: false,
          message: '激活码已过期',
          status: 400,
        }
      }

      return createActivationSuccessResult(activationCode, '激活码已激活')
    }

    const now = new Date()
    const expiresAt = activationCode.validDays
      ? new Date(now.getTime() + activationCode.validDays * 24 * 60 * 60 * 1000)
      : null

    const updatedCode = await tx.activationCode.update({
      where: {
        id: activationCode.id,
      },
      data: {
        isUsed: true,
        usedAt: now,
        usedBy: machineId,
        expiresAt,
      },
    })

    return createActivationSuccessResult(updatedCode, '激活码激活成功')
  })
}

export async function consumeLicense(client: PrismaClient, input: ConsumeLicenseInput): Promise<LicenseResult> {
  const code = normalizeCode(input.code)
  const machineId = normalizeMachineId(input.machineId)
  const requestId = input.requestId?.trim()

  if (!code || !machineId) {
    return createMissingParamsResult()
  }

  const project = await resolveProject(client, input.projectKey)

  return client.$transaction(async (tx) => {
    if (requestId) {
      const existingConsumption = await tx.licenseConsumption.findUnique({
        where: {
          requestId,
        },
        include: {
          activationCode: true,
        },
      })

      if (existingConsumption) {
        const sameRequest =
          existingConsumption.activationCode.code === code &&
          existingConsumption.activationCode.projectId === project.id &&
          existingConsumption.machineId === machineId

        if (!sameRequest) {
          return {
            success: false,
            message: 'requestId 已被其他请求使用',
            status: 409,
          }
        }

        return {
          success: true,
          message: '请求已处理',
          status: 200,
          licenseMode: existingConsumption.activationCode.licenseMode,
          remainingCount: existingConsumption.remainingCountAfter,
          expiresAt: getActualExpiresAt(existingConsumption.activationCode),
          isActivated: existingConsumption.activationCode.isUsed,
          valid: (existingConsumption.remainingCountAfter ?? 0) > 0,
          idempotent: true,
        }
      }
    }

    const existingBinding = await findMachineBinding(tx, project.id, machineId)
    if (existingBinding && existingBinding.code !== code && !canReuseProjectBinding(existingBinding)) {
      return {
        success: false,
        message: buildReusableConflictMessage(existingBinding),
        status: 400,
      }
    }

    const activationCode = await findProjectActivationCode(tx, project.id, code)
    if (!activationCode) {
      return {
        success: false,
        message: '激活码不存在',
        status: 404,
      }
    }

    if (activationCode.usedBy && activationCode.usedBy !== machineId) {
      return {
        success: false,
        message: '激活码已被其他设备使用',
        status: 400,
      }
    }

    if (activationCode.licenseMode === 'TIME') {
      if (!activationCode.isUsed) {
        const now = new Date()
        const expiresAt = activationCode.validDays
          ? new Date(now.getTime() + activationCode.validDays * 24 * 60 * 60 * 1000)
          : null

        const updatedCode = await tx.activationCode.update({
          where: {
            id: activationCode.id,
          },
          data: {
            isUsed: true,
            usedAt: now,
            usedBy: machineId,
            expiresAt,
          },
        })

        return {
          success: true,
          message: '激活码验证成功',
          status: 200,
          licenseMode: updatedCode.licenseMode,
          expiresAt: getActualExpiresAt(updatedCode),
          isActivated: updatedCode.isUsed,
          valid: true,
        }
      }

      if (isCodeExpired(activationCode)) {
        return {
          success: false,
          message: '激活码已过期',
          status: 400,
        }
      }

      return {
        success: true,
        message: '激活码验证成功',
        status: 200,
        licenseMode: activationCode.licenseMode,
        expiresAt: getActualExpiresAt(activationCode),
        isActivated: activationCode.isUsed,
        valid: true,
      }
    }

    const currentRemainingCount = getRemainingCount(activationCode)
    if (!currentRemainingCount || currentRemainingCount <= 0) {
      return {
        success: false,
        message: '激活码可用次数已用完',
        status: 400,
      }
    }

    const now = new Date()
    const updatedCode = await tx.activationCode.update({
      where: {
        id: activationCode.id,
      },
      data: {
        isUsed: true,
        usedAt: activationCode.usedAt ?? now,
        usedBy: machineId,
        remainingCount: currentRemainingCount - 1,
        consumedCount: {
          increment: 1,
        },
      },
    })

    if (requestId) {
      await tx.licenseConsumption.create({
        data: {
          requestId,
          activationCodeId: updatedCode.id,
          machineId,
          remainingCountAfter: updatedCode.remainingCount ?? 0,
        },
      })
    }

    return {
      success: true,
      message: '激活码验证成功',
      status: 200,
      licenseMode: updatedCode.licenseMode,
      remainingCount: updatedCode.remainingCount,
      isActivated: updatedCode.isUsed,
      valid: (updatedCode.remainingCount ?? 0) > 0,
      idempotent: false,
    }
  })
}

export async function verifyActivationCode(client: PrismaClient, input: LicenseActionInput): Promise<LicenseResult> {
  return consumeLicense(client, input)
}
