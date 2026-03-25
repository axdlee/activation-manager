import type { PrismaClient } from '@prisma/client'

import { prisma } from '@/lib/db'
import {
  createLicenseErrorResponse,
  createLegacyLicenseResponse,
  createLicenseResponse,
  readLicenseRequest,
} from '@/lib/license-api'
import {
  activateLicense,
  consumeLicense,
  getLicenseStatus,
  verifyActivationCode,
} from '@/lib/license-service'

async function executeLicenseRequest(
  request: Request,
  handler: (params: {
    projectKey?: string
    code: string
    machineId: string
    requestId?: string
  }) => ReturnType<typeof activateLicense>,
  options: {
    errorMessage: string
    legacyOnly?: boolean
  },
) {
  try {
    const result = await handler(await readLicenseRequest(request))
    return options.legacyOnly ? createLegacyLicenseResponse(result) : createLicenseResponse(result)
  } catch (error) {
    return createLicenseErrorResponse(options.errorMessage, error)
  }
}

export async function handleActivateLicenseRequest(
  request: Request,
  client: PrismaClient = prisma,
) {
  return executeLicenseRequest(
    request,
    ({ projectKey, code, machineId }) =>
      activateLicense(client, {
        projectKey,
        code,
        machineId,
      }),
    {
      errorMessage: '激活激活码失败',
    },
  )
}

export async function handleConsumeLicenseRequest(
  request: Request,
  client: PrismaClient = prisma,
) {
  return executeLicenseRequest(
    request,
    ({ projectKey, code, machineId, requestId }) =>
      consumeLicense(client, {
        projectKey,
        code,
        machineId,
        requestId,
      }),
    {
      errorMessage: '消费激活码失败',
    },
  )
}

export async function handleLicenseStatusRequest(
  request: Request,
  client: PrismaClient = prisma,
) {
  return executeLicenseRequest(
    request,
    ({ projectKey, code, machineId }) =>
      getLicenseStatus(client, {
        projectKey,
        code,
        machineId,
      }),
    {
      errorMessage: '获取激活码状态失败',
    },
  )
}

export async function handleVerifyLicenseRequest(
  request: Request,
  client: PrismaClient = prisma,
) {
  return executeLicenseRequest(
    request,
    ({ projectKey, code, machineId }) =>
      verifyActivationCode(client, {
        projectKey,
        code,
        machineId,
      }),
    {
      errorMessage: '验证激活码失败',
      legacyOnly: true,
    },
  )
}
