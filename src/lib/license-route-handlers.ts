import type { PrismaClient } from '@prisma/client'

import { prisma } from '@/lib/db'
import {
  createLicenseErrorResponse,
  createLicenseResponse,
  readLicenseRequest,
} from '@/lib/license-api'
import {
  activateLicense,
  consumeLicense,
  getLicenseStatus,
} from '@/lib/license-service'

export async function handleActivateLicenseRequest(
  request: Request,
  client: PrismaClient = prisma,
) {
  try {
    const { projectKey, code, machineId } = await readLicenseRequest(request)
    const result = await activateLicense(client, {
      projectKey,
      code,
      machineId,
    })

    return createLicenseResponse(result)
  } catch (error) {
    return createLicenseErrorResponse('激活激活码失败', error)
  }
}

export async function handleConsumeLicenseRequest(
  request: Request,
  client: PrismaClient = prisma,
) {
  try {
    const { projectKey, code, machineId, requestId } = await readLicenseRequest(request)
    const result = await consumeLicense(client, {
      projectKey,
      code,
      machineId,
      requestId,
    })

    return createLicenseResponse(result)
  } catch (error) {
    return createLicenseErrorResponse('消费激活码失败', error)
  }
}

export async function handleLicenseStatusRequest(
  request: Request,
  client: PrismaClient = prisma,
) {
  try {
    const { projectKey, code, machineId } = await readLicenseRequest(request)
    const result = await getLicenseStatus(client, {
      projectKey,
      code,
      machineId,
    })

    return createLicenseResponse(result)
  } catch (error) {
    return createLicenseErrorResponse('获取激活码状态失败', error)
  }
}
