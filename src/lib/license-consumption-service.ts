import { Prisma } from '@prisma/client'

import { findProjectByProjectKey, type DbClient } from './license-project-service'

type ListLicenseConsumptionsInput = {
  projectKey?: string
  keyword?: string
  createdFrom?: string | Date
  createdTo?: string | Date
}

type ListLicenseConsumptionsPageInput = ListLicenseConsumptionsInput & {
  page?: number
  pageSize?: number
}

type LicenseConsumptionsPagination = {
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const DEFAULT_LICENSE_CONSUMPTION_PAGE = 1
const DEFAULT_LICENSE_CONSUMPTION_PAGE_SIZE = 10
const MAX_LICENSE_CONSUMPTION_PAGE_SIZE = 100

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

function normalizePositiveInteger(value: number | undefined, fieldName: string) {
  if (value === undefined) {
    return null
  }

  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${fieldName} 必须是大于 0 的整数`)
  }

  return value
}

function normalizeLicenseConsumptionPage(value?: number) {
  return (
    normalizePositiveInteger(value, 'page') ?? DEFAULT_LICENSE_CONSUMPTION_PAGE
  )
}

function normalizeLicenseConsumptionPageSize(value?: number) {
  const normalizedPageSize =
    normalizePositiveInteger(value, 'pageSize') ?? DEFAULT_LICENSE_CONSUMPTION_PAGE_SIZE

  if (normalizedPageSize > MAX_LICENSE_CONSUMPTION_PAGE_SIZE) {
    throw new Error(`pageSize 必须是 1-${MAX_LICENSE_CONSUMPTION_PAGE_SIZE} 之间的整数`)
  }

  return normalizedPageSize
}

async function buildLicenseConsumptionQuery(
  client: DbClient,
  input?: ListLicenseConsumptionsInput,
) {
  const normalizedProjectKey = input?.projectKey?.trim()
  const normalizedKeyword = input?.keyword?.trim()
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

  const conditions: Prisma.LicenseConsumptionWhereInput[] = []

  if (project) {
    conditions.push({
      activationCode: {
        projectId: project.id,
      },
    })
  }

  if (createdFrom || createdTo) {
    conditions.push({
      createdAt: {
        ...(createdFrom ? { gte: createdFrom } : {}),
        ...(createdTo ? { lte: createdTo } : {}),
      },
    })
  }

  if (normalizedKeyword) {
    conditions.push({
      OR: [
        {
          requestId: {
            contains: normalizedKeyword,
          },
        },
        {
          machineId: {
            contains: normalizedKeyword,
          },
        },
        {
          activationCode: {
            code: {
              contains: normalizedKeyword,
            },
          },
        },
      ],
    })
  }

  return {
    where:
      conditions.length === 0
        ? undefined
        : conditions.length === 1
          ? conditions[0]
          : { AND: conditions },
  }
}

const licenseConsumptionInclude = {
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
} as const

export async function listLicenseConsumptions(
  client: DbClient,
  input?: ListLicenseConsumptionsInput,
) {
  const { where } = await buildLicenseConsumptionQuery(client, input)

  return client.licenseConsumption.findMany({
    where,
    include: licenseConsumptionInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  })
}

export async function listLicenseConsumptionsPage(
  client: DbClient,
  input?: ListLicenseConsumptionsPageInput,
): Promise<{
  logs: Awaited<ReturnType<typeof listLicenseConsumptions>>
  pagination: LicenseConsumptionsPagination
}> {
  const page = normalizeLicenseConsumptionPage(input?.page)
  const pageSize = normalizeLicenseConsumptionPageSize(input?.pageSize)
  const { where } = await buildLicenseConsumptionQuery(client, input)
  const total = await client.licenseConsumption.count({
    where,
  })
  const totalPages = total === 0 ? 1 : Math.ceil(total / pageSize)
  const currentPage = total === 0 ? 1 : Math.min(page, totalPages)
  const logs = await client.licenseConsumption.findMany({
    where,
    include: licenseConsumptionInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    skip: (currentPage - 1) * pageSize,
    take: pageSize,
  })

  return {
    logs,
    pagination: {
      total,
      page: currentPage,
      pageSize,
      totalPages,
    },
  }
}
