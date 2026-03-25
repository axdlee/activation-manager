import type { PrismaClient } from '@prisma/client'

import { prisma } from '@/lib/db'
import {
  createLicenseErrorResponse,
  createLegacyLicenseResponse,
  createLicenseResponse,
  type LicenseApiRequestParams,
  readLicenseRequest,
} from '@/lib/license-api'
import {
  activateLicense,
  consumeLicense,
  getLicenseStatus,
  verifyActivationCode,
} from '@/lib/license-service'
import type { LicenseResult } from '@/lib/license-result-service'

type LicenseRouteOptions = {
  errorMessage: string
  legacyOnly?: boolean
}

async function executeLicenseRequest(
  request: Request,
  handler: (params: LicenseApiRequestParams) => Promise<LicenseResult>,
  options: LicenseRouteOptions,
) {
  try {
    const result = await handler(await readLicenseRequest(request))
    return options.legacyOnly ? createLegacyLicenseResponse(result) : createLicenseResponse(result)
  } catch (error) {
    return createLicenseErrorResponse(options.errorMessage, error)
  }
}

export function createLicenseRouteHandler(
  service: (
    client: PrismaClient,
    params: LicenseApiRequestParams,
  ) => Promise<LicenseResult>,
  options: LicenseRouteOptions,
) {
  return async (
    request: Request,
    client: PrismaClient = prisma,
  ) => executeLicenseRequest(
    request,
    (params) => service(client, params),
    options,
  )
}

export const handleActivateLicenseRequest = createLicenseRouteHandler(
  async (client, { projectKey, code, machineId }) =>
    activateLicense(client, {
      projectKey,
      code,
      machineId,
    }),
  {
    errorMessage: '激活激活码失败',
  },
)

export const handleConsumeLicenseRequest = createLicenseRouteHandler(
  async (client, { projectKey, code, machineId, requestId }) =>
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

export const handleLicenseStatusRequest = createLicenseRouteHandler(
  async (client, { projectKey, code, machineId }) =>
    getLicenseStatus(client, {
      projectKey,
      code,
      machineId,
    }),
  {
    errorMessage: '获取激活码状态失败',
  },
)

export const handleVerifyLicenseRequest = createLicenseRouteHandler(
  async (client, { projectKey, code, machineId }) =>
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
