import type { PrismaClient } from '@prisma/client'

import { prisma } from '@/lib/db'
import { getConfigWithDefault } from '@/lib/config-service'
import { resolveServerLocale, serverT } from '@/lib/i18n/server'
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
import {
  defaultLicenseApiRateLimiter,
  buildLicenseApiRateLimitKey,
  type LicenseApiRateLimiter,
} from '@/lib/license-api-rate-limit'
import { recordLicenseApiRequest } from '@/lib/license-api-metrics'

type LicenseRouteOptions = {
  /** catch 兜底错误消息的词典 key（i18n），按请求语言翻译 */
  errorMessage: string
  legacyOnly?: boolean
}

async function executeLicenseRequest(
  request: Request,
  handler: (params: LicenseApiRequestParams) => Promise<LicenseResult>,
  options: LicenseRouteOptions,
  rateLimiter: LicenseApiRateLimiter = defaultLicenseApiRateLimiter,
) {
  const t = serverT(resolveServerLocale(request))
  const path = new URL(request.url).pathname
  const rateLimitKey = buildLicenseApiRateLimitKey(request, path)
  const rateLimitResult = rateLimiter.check(rateLimitKey)

  if (!rateLimitResult.allowed) {
    recordLicenseApiRequest({
      pathname: path,
      success: false,
      rateLimited: true,
      durationMs: 0,
    })
    return new Response(
      JSON.stringify({
        success: false,
        message: t('api.rateLimited'),
      }),
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimitResult.retryAfterSeconds),
          'Content-Type': 'application/json',
        },
      },
    )
  }

  const startedAt = performance.now()

  try {
    const result = await handler(await readLicenseRequest(request))
    const responseSecret = await resolveLicenseResponseSecret()
    const response = options.legacyOnly
      ? createLegacyLicenseResponse(result, responseSecret)
      : createLicenseResponse(result, responseSecret)
    recordLicenseApiRequest({
      pathname: path,
      success: result.success,
      durationMs: Math.round(performance.now() - startedAt),
    })
    return response
  } catch (error) {
    recordLicenseApiRequest({
      pathname: path,
      success: false,
      durationMs: Math.round(performance.now() - startedAt),
    })
    return createLicenseErrorResponse(t(options.errorMessage), error)
  }
}

type LicenseRouteDependencies = {
  rateLimiter?: LicenseApiRateLimiter
}

export function createLicenseRouteHandler(
  service: (
    client: PrismaClient,
    params: LicenseApiRequestParams,
  ) => Promise<LicenseResult>,
  options: LicenseRouteOptions,
  dependencies: LicenseRouteDependencies = {},
) {
  return async (
    request: Request,
    client: PrismaClient = prisma,
  ) => executeLicenseRequest(
    request,
    (params) => service(client, params),
    options,
    dependencies.rateLimiter ?? defaultLicenseApiRateLimiter,
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
    errorMessage: 'code.activateFailed',
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
    errorMessage: 'code.consumeFailed',
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
    errorMessage: 'code.statusFailed',
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
    errorMessage: 'code.verifyFailed',
    legacyOnly: true,
  },
)


async function resolveLicenseResponseSecret() {
  const value = await getConfigWithDefault('licenseResponseSecret')
  return typeof value === 'string' ? value.trim() : ''
}
