import { type LicenseConsumptionRequestContext } from './license-action-context'
import {
  createCountConsumeSuccessResult,
  createPendingConsumptionRequestResult,
  createRequestIdConflictResult,
  type LicenseResult,
} from './license-result-service'
import { type DbClient } from './license-project-service'
import { isPrismaUniqueConstraintError } from './prisma-error-utils'

const PENDING_CONSUMPTION_REMAINING = -1
const REQUEST_ID_SETTLE_RETRY_LIMIT = 5

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function findConsumptionByRequestId(client: DbClient, requestId: string) {
  return client.licenseConsumption.findUnique({
    where: {
      requestId,
    },
    include: {
      activationCode: true,
    },
  })
}

export async function waitForSettledConsumptionByRequestId(client: DbClient, requestId: string) {
  let existingConsumption = await findConsumptionByRequestId(client, requestId)

  for (
    let attempt = 0;
    existingConsumption && existingConsumption.remainingCountAfter < 0 && attempt < REQUEST_ID_SETTLE_RETRY_LIMIT;
    attempt += 1
  ) {
    await sleep(0)
    existingConsumption = await findConsumptionByRequestId(client, requestId)
  }

  return existingConsumption
}

export function buildExistingConsumptionResult(
  existingConsumption: Awaited<ReturnType<typeof findConsumptionByRequestId>>,
  context: LicenseConsumptionRequestContext,
): LicenseResult | null {
  if (!existingConsumption) {
    return null
  }

  if (existingConsumption.remainingCountAfter < 0) {
    return createPendingConsumptionRequestResult()
  }

  const sameRequest =
    existingConsumption.activationCode.code === context.code &&
    existingConsumption.activationCode.projectId === context.projectId &&
    existingConsumption.machineId === context.machineId

  if (!sameRequest) {
    return createRequestIdConflictResult()
  }

  return createCountConsumeSuccessResult(existingConsumption.activationCode, {
    remainingCount: existingConsumption.remainingCountAfter,
    message: '请求已处理',
    idempotent: true,
    includeExpiresAt: true,
  })
}

export async function resolveExistingConsumptionResult(
  client: DbClient,
  requestId: string,
  context: LicenseConsumptionRequestContext,
) {
  const existingConsumption = await waitForSettledConsumptionByRequestId(client, requestId)
  return buildExistingConsumptionResult(existingConsumption, context)
}

export async function claimConsumptionRequestId(
  client: DbClient,
  params: {
    requestId: string
    activationCodeId: number
    machineId: string
  },
  context: LicenseConsumptionRequestContext,
) {
  try {
    await client.licenseConsumption.create({
      data: {
        requestId: params.requestId,
        activationCodeId: params.activationCodeId,
        machineId: params.machineId,
        remainingCountAfter: PENDING_CONSUMPTION_REMAINING,
      },
    })

    return {
      claimed: true,
      existingResult: null,
    } as const
  } catch (error) {
    if (!isPrismaUniqueConstraintError(error, 'requestId')) {
      throw error
    }

    return {
      claimed: false,
      existingResult:
        (await resolveExistingConsumptionResult(client, params.requestId, context)) ??
        createPendingConsumptionRequestResult(),
    } as const
  }
}
