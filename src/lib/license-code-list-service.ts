import { PrismaClient } from '@prisma/client'

import { isCodeExpired, isCountCodeDepleted, type LicenseStatusLike } from './license-status'

export type ActivationCodeListFilters = {
  keyword?: string
  status?: 'all' | 'unused' | 'used' | 'expired' | 'depleted'
  projectKey?: string
  cardType?: string
  page?: number
  pageSize?: number
}

export type ActivationCodeListResult = {
  codes: Array<{
    id: number
    code: string
    projectId: number
    licenseMode: string
    isUsed: boolean
    usedAt: Date | null
    usedBy: string | null
    createdAt: Date
    expiresAt: Date | null
    validDays: number | null
    totalCount: number | null
    remainingCount: number | null
    consumedCount: number
    cardType: string | null
    allowAutoRebind: boolean | null
    autoRebindCooldownMinutes: number | null
    autoRebindMaxCount: number | null
    rebindCount: number
    autoRebindCount: number
    lastBoundAt: Date | null
    lastRebindAt: Date | null
    project?: {
      id: number
      name: string
      projectKey: string
      allowAutoRebind?: boolean | null
      autoRebindCooldownMinutes?: number | null
      autoRebindMaxCount?: number | null
    } | null
  }>
  total: number
  page: number
  pageSize: number
  totalPages: number
  statusSummary: {
    unused: number
    inUse: number
    risk: number
  }
  projectCoverage: number
  availableCardTypes: string[]
}

function getCodeStatusLabelForList(code: {
  licenseMode: string | null
  isUsed: boolean
  usedAt: Date | null
  expiresAt: Date | null
  validDays: number | null
  remainingCount: number | null
}, now: Date): string {
  if (code.licenseMode === 'COUNT') {
    if (!code.isUsed) return '未激活'
    if (code.remainingCount !== null && code.remainingCount <= 0) return '已耗尽'
    return '使用中'
  }

  // TIME
  if (isCodeExpired(code as LicenseStatusLike, now)) return '已过期'
  if (code.isUsed) return '已使用'
  return '未激活'
}

export async function listActivationCodes(
  client: PrismaClient,
  filters: ActivationCodeListFilters = {},
): Promise<ActivationCodeListResult> {
  const now = new Date()
  const hasPagination = filters.page !== undefined || filters.pageSize !== undefined
  // 未显式传分页参数时返回全部匹配（兼容 dashboard 现有全量消费）；
  // 显式传 page/pageSize 才走服务端分页。
  const page = hasPagination ? Math.max(1, filters.page ?? 1) : 1
  const requestedPageSize = hasPagination
    ? (filters.pageSize ?? 10)
    : Number.MAX_SAFE_INTEGER
  const pageSize = hasPagination ? Math.min(100, Math.max(1, requestedPageSize)) : Number.MAX_SAFE_INTEGER
  const skip = hasPagination ? (page - 1) * pageSize : 0

  // ===== 1. Build base WHERE from keyword / projectKey / cardType =====
  const baseConditions: Array<Record<string, unknown>> = []

  if (filters.keyword?.trim()) {
    const kw = filters.keyword.trim()
    baseConditions.push({
      OR: [
        { code: { contains: kw } },
        { usedBy: { contains: kw } },
      ],
    })
  }

  if (filters.projectKey && filters.projectKey !== 'all') {
    baseConditions.push({
      project: { projectKey: filters.projectKey },
    })
  }

  if (filters.cardType && filters.cardType !== 'all') {
    if (filters.cardType === 'none') {
      baseConditions.push({ cardType: null })
    } else {
      baseConditions.push({ cardType: filters.cardType })
    }
  }

  const baseWhere = baseConditions.length > 0 ? { AND: baseConditions } : {}

  // ===== 2. Fetch all matching codes (lightweight columns) for summary + status filter =====
  const allMatchingCodes = await client.activationCode.findMany({
    where: baseWhere,
    select: {
      id: true,
      code: true,
      projectId: true,
      licenseMode: true,
      isUsed: true,
      usedAt: true,
      usedBy: true,
      createdAt: true,
      expiresAt: true,
      validDays: true,
      totalCount: true,
      remainingCount: true,
      consumedCount: true,
      cardType: true,
      allowAutoRebind: true,
      autoRebindCooldownMinutes: true,
      autoRebindMaxCount: true,
      rebindCount: true,
      autoRebindCount: true,
      lastBoundAt: true,
      lastRebindAt: true,
      project: {
        select: {
          id: true,
          name: true,
          projectKey: true,
          allowAutoRebind: true,
          autoRebindCooldownMinutes: true,
          autoRebindMaxCount: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  // ===== 3. Compute status label for each code =====
  const codesWithStatus = allMatchingCodes.map((code) => ({
    ...code,
    _statusLabel: getCodeStatusLabelForList(code, now),
  }))

  // ===== 4. Apply status filter in memory =====
  const statusFiltered = filters.status && filters.status !== 'all'
    ? codesWithStatus.filter((c) => {
        switch (filters.status) {
          case 'unused': return c._statusLabel === '未激活'
          case 'used': return c._statusLabel === '已使用' || c._statusLabel === '使用中'
          case 'expired': return c._statusLabel === '已过期'
          case 'depleted': return c._statusLabel === '已耗尽'
          default: return true
        }
      })
    : codesWithStatus

  // ===== 5. Compute summary from all matching codes (after status filter) =====
  const statusSummary = { unused: 0, inUse: 0, risk: 0 }
  const projectKeys = new Set<string>()

  for (const code of statusFiltered) {
    if (code._statusLabel === '未激活') statusSummary.unused++
    else if (code._statusLabel === '已过期' || code._statusLabel === '已耗尽') statusSummary.risk++
    else statusSummary.inUse++

    if (code.project) projectKeys.add(code.project.projectKey)
  }

  // ===== 6. availableCardTypes：基于全量码（不受当前筛选影响），保证筛选项稳定 =====
  const allCardTypeRows = await client.activationCode.findMany({
    select: { cardType: true },
    where: { cardType: { not: null } },
    distinct: ['cardType'],
  })
  const availableCardTypes = allCardTypeRows
    .map((row) => row.cardType)
    .filter((value): value is string => Boolean(value))
    .sort()

  // ===== 7. Paginate =====
  const total = statusFiltered.length
  const totalPages = hasPagination ? Math.max(1, Math.ceil(total / pageSize)) : 1
  const paginatedCodes = statusFiltered.slice(skip, skip + pageSize)

  return {
    codes: paginatedCodes.map(({ _statusLabel, ...code }) => code),
    total,
    page,
    pageSize,
    totalPages,
    statusSummary,
    projectCoverage: projectKeys.size,
    availableCardTypes,
  }
}