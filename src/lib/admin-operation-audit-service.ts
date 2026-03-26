import { Prisma, PrismaClient } from '@prisma/client'

import { findProjectByProjectKey } from './license-project-service'

type AdminOperationAuditPersistenceClient = PrismaClient | Prisma.TransactionClient

export type AdminOperationType =
  | 'CODE_REBIND_SETTINGS_UPDATED'
  | 'CODE_FORCE_UNBIND'
  | 'CODE_FORCE_REBIND'
  | 'PROJECT_REBIND_SETTINGS_UPDATED'
  | 'PROJECT_CREATED'
  | 'CODE_BATCH_GENERATED'

type RecordAdminOperationAuditLogInput = {
  adminUsername: string
  operationType: AdminOperationType
  activationCodeId?: number | null
  projectId?: number | null
  targetLabel?: string | null
  reason?: string | null
  detail?: unknown
}

type ListAdminOperationAuditLogsInput = {
  projectKey?: string
  keyword?: string
  operationType?: string
  createdFrom?: string | Date
  createdTo?: string | Date
}

type ListAdminOperationAuditLogsPageInput = ListAdminOperationAuditLogsInput & {
  page?: number
  pageSize?: number
}

type AdminOperationAuditLogsPagination = {
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const DEFAULT_ADMIN_AUDIT_LOG_PAGE = 1
const DEFAULT_ADMIN_AUDIT_LOG_PAGE_SIZE = 10
const MAX_ADMIN_AUDIT_LOG_PAGE_SIZE = 100

function normalizeOptionalText(value?: string | null) {
  const normalizedValue = value?.trim()
  return normalizedValue ? normalizedValue : null
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

function normalizePositiveInteger(value: number | undefined, fieldName: string) {
  if (value === undefined) {
    return null
  }

  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${fieldName} 必须是大于 0 的整数`)
  }

  return value
}

function normalizeAdminAuditLogPage(value?: number) {
  return normalizePositiveInteger(value, 'page') ?? DEFAULT_ADMIN_AUDIT_LOG_PAGE
}

function normalizeAdminAuditLogPageSize(value?: number) {
  const normalizedPageSize =
    normalizePositiveInteger(value, 'pageSize') ?? DEFAULT_ADMIN_AUDIT_LOG_PAGE_SIZE

  if (normalizedPageSize > MAX_ADMIN_AUDIT_LOG_PAGE_SIZE) {
    throw new Error(`pageSize 必须是 1-${MAX_ADMIN_AUDIT_LOG_PAGE_SIZE} 之间的整数`)
  }

  return normalizedPageSize
}

async function buildAdminOperationAuditQuery(
  client: AdminOperationAuditPersistenceClient,
  input?: ListAdminOperationAuditLogsInput,
) {
  const normalizedProjectKey = input?.projectKey?.trim()
  const normalizedKeyword = input?.keyword?.trim()
  const normalizedOperationType = input?.operationType?.trim()
  const createdFrom = normalizeOptionalDateInput(input?.createdFrom)
  const createdTo = normalizeOptionalDateInput(input?.createdTo)
  let project: Awaited<ReturnType<typeof findProjectByProjectKey>> = null

  try {
    project = await findProjectByProjectKey(client, normalizedProjectKey)
  } catch (error) {
    if (
      normalizedProjectKey &&
      error instanceof Error &&
      error.message === `项目不存在: ${normalizedProjectKey}`
    ) {
      return {
        where: {
          projectId: -1,
        } satisfies Prisma.AdminOperationAuditLogWhereInput,
      }
    }

    throw error
  }

  if (input?.createdFrom && !createdFrom) {
    throw new Error('createdFrom 时间格式不正确')
  }

  if (input?.createdTo && !createdTo) {
    throw new Error('createdTo 时间格式不正确')
  }

  if (createdFrom && createdTo && createdFrom > createdTo) {
    throw new Error('createdFrom 不能晚于 createdTo')
  }

  const conditions: Prisma.AdminOperationAuditLogWhereInput[] = []

  if (project) {
    conditions.push({
      projectId: project.id,
    })
  }

  if (normalizedOperationType) {
    conditions.push({
      operationType: normalizedOperationType,
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
          adminUsername: {
            contains: normalizedKeyword,
          },
        },
        {
          targetLabel: {
            contains: normalizedKeyword,
          },
        },
        {
          reason: {
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
        {
          project: {
            name: {
              contains: normalizedKeyword,
            },
          },
        },
        {
          project: {
            projectKey: {
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

const adminOperationAuditLogInclude = {
  project: {
    select: {
      id: true,
      name: true,
      projectKey: true,
    },
  },
  activationCode: {
    select: {
      id: true,
      code: true,
    },
  },
} as const

export async function recordAdminOperationAuditLog(
  client: AdminOperationAuditPersistenceClient,
  input: RecordAdminOperationAuditLogInput,
) {
  if (!('adminOperationAuditLog' in client)) {
    return null
  }

  const adminUsername = input.adminUsername.trim()

  if (!adminUsername) {
    throw new Error('adminUsername 不能为空')
  }

  return client.adminOperationAuditLog.create({
    data: {
      adminUsername,
      operationType: input.operationType,
      activationCodeId: input.activationCodeId ?? null,
      projectId: input.projectId ?? null,
      targetLabel: normalizeOptionalText(input.targetLabel),
      reason: normalizeOptionalText(input.reason),
      detailJson: input.detail === undefined ? null : JSON.stringify(input.detail),
    },
  })
}

export async function listAdminOperationAuditLogs(
  client: AdminOperationAuditPersistenceClient,
  input?: ListAdminOperationAuditLogsInput,
) {
  const { where } = await buildAdminOperationAuditQuery(client, input)

  return client.adminOperationAuditLog.findMany({
    where,
    include: adminOperationAuditLogInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  })
}

export async function listAdminOperationAuditLogsPage(
  client: AdminOperationAuditPersistenceClient,
  input?: ListAdminOperationAuditLogsPageInput,
): Promise<{
  logs: Awaited<ReturnType<typeof listAdminOperationAuditLogs>>
  pagination: AdminOperationAuditLogsPagination
}> {
  const page = normalizeAdminAuditLogPage(input?.page)
  const pageSize = normalizeAdminAuditLogPageSize(input?.pageSize)
  const { where } = await buildAdminOperationAuditQuery(client, input)
  const total = await client.adminOperationAuditLog.count({
    where,
  })
  const totalPages = total === 0 ? 1 : Math.ceil(total / pageSize)
  const currentPage = total === 0 ? 1 : Math.min(page, totalPages)
  const logs = await client.adminOperationAuditLog.findMany({
    where,
    include: adminOperationAuditLogInclude,
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
