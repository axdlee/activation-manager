import { getRemainingCount, isCodeExpired } from './license-status'
import { isProjectMachineUniqueConstraintError } from './license-binding-service'
import {
  type LicenseActionCodeRecord,
  type LicenseConflictResolver,
  type LicenseIdempotencyClaimResult,
} from './license-action-context'
import {
  createCountConsumeSuccessResult,
  createCountExhaustedResult,
  createExpiredResult,
  createLicenseNotFoundResult,
  createStateChangedRetryResult,
  createTimeConsumeSuccessResult,
  createUsedByOtherDeviceResult,
  type LicenseResult,
} from './license-result-service'
import { type DbClient } from './license-project-service'

type ConsumeMutationClient = Pick<DbClient, 'activationCode'>

export async function consumeTimeLicense(params: {
  tx: ConsumeMutationClient
  activationCode: LicenseActionCodeRecord
  projectId: number
  code: string
  machineId: string
  reloadActivationCode: () => Promise<LicenseActionCodeRecord | null>
  resolveProjectMachineConflict: LicenseConflictResolver
}): Promise<LicenseResult> {
  const {
    tx,
    activationCode,
    machineId,
    reloadActivationCode,
    resolveProjectMachineConflict,
  } = params

  if (!activationCode.isUsed) {
    const now = new Date()
    const expiresAt = activationCode.validDays
      ? new Date(now.getTime() + activationCode.validDays * 24 * 60 * 60 * 1000)
      : null

    try {
      const updateResult = await tx.activationCode.updateMany({
        where: {
          id: activationCode.id,
          projectId: params.projectId,
          isUsed: false,
          OR: [{ usedBy: null }, { usedBy: machineId }],
        },
        data: {
          isUsed: true,
          usedAt: now,
          usedBy: machineId,
          expiresAt,
        },
      })

      const updatedCode = await reloadActivationCode()
      if (!updatedCode) {
        return createLicenseNotFoundResult()
      }

      if (updateResult.count === 0) {
        if (updatedCode.usedBy && updatedCode.usedBy !== machineId) {
          return createUsedByOtherDeviceResult()
        }

        if (isCodeExpired(updatedCode)) {
          return createExpiredResult()
        }
      }

      return createTimeConsumeSuccessResult(updatedCode)
    } catch (error) {
      if (isProjectMachineUniqueConstraintError(error)) {
        return resolveProjectMachineConflict()
      }

      throw error
    }
  }

  if (isCodeExpired(activationCode)) {
    return createExpiredResult()
  }

  return createTimeConsumeSuccessResult(activationCode)
}

export async function consumeCountLicense(params: {
  tx: ConsumeMutationClient
  activationCode: LicenseActionCodeRecord
  projectId: number
  code: string
  machineId: string
  requestId?: string
  claimRequestId?: () => Promise<LicenseIdempotencyClaimResult>
  rollbackClaimedRequestId?: (requestId: string) => Promise<void>
  reloadActivationCode: () => Promise<LicenseActionCodeRecord | null>
  persistConsumptionRemainingCount?: (requestId: string, remainingCountAfter: number) => Promise<void>
  resolveProjectMachineConflict: LicenseConflictResolver
}): Promise<LicenseResult> {
  const {
    tx,
    activationCode,
    machineId,
    requestId,
    claimRequestId,
    rollbackClaimedRequestId,
    reloadActivationCode,
    persistConsumptionRemainingCount,
    resolveProjectMachineConflict,
  } = params

  const currentRemainingCount = getRemainingCount(activationCode)
  if (!currentRemainingCount || currentRemainingCount <= 0) {
    return createCountExhaustedResult()
  }

  let claimedRequestId = false
  if (requestId && claimRequestId) {
    const claimResult = await claimRequestId()
    if (claimResult.existingResult) {
      return claimResult.existingResult
    }

    claimedRequestId = claimResult.claimed
  }

  const rollbackIfClaimed = async () => {
    if (claimedRequestId && requestId && rollbackClaimedRequestId) {
      await rollbackClaimedRequestId(requestId)
    }
  }

  try {
    const updateResult = await tx.activationCode.updateMany({
      where: {
        id: activationCode.id,
        projectId: params.projectId,
        licenseMode: 'COUNT',
        remainingCount: {
          gt: 0,
        },
        OR: [{ usedBy: null }, { usedBy: machineId }],
      },
      data: {
        isUsed: true,
        usedBy: machineId,
        remainingCount: {
          decrement: 1,
        },
        consumedCount: {
          increment: 1,
        },
      },
    })

    if (updateResult.count === 0) {
      await rollbackIfClaimed()

      const latestCode = await reloadActivationCode()
      if (!latestCode) {
        return createLicenseNotFoundResult()
      }

      if (latestCode.usedBy && latestCode.usedBy !== machineId) {
        return createUsedByOtherDeviceResult()
      }

      if ((getRemainingCount(latestCode) ?? 0) <= 0) {
        return createCountExhaustedResult()
      }

      return createStateChangedRetryResult()
    }
  } catch (error) {
    if (isProjectMachineUniqueConstraintError(error)) {
      await rollbackIfClaimed()
      return resolveProjectMachineConflict()
    }

    throw error
  }

  await tx.activationCode.updateMany({
    where: {
      id: activationCode.id,
      usedAt: null,
    },
    data: {
      usedAt: new Date(),
    },
  })

  const updatedCode = await reloadActivationCode()
  if (!updatedCode) {
    await rollbackIfClaimed()
    return createLicenseNotFoundResult()
  }

  if (requestId && persistConsumptionRemainingCount) {
    await persistConsumptionRemainingCount(requestId, updatedCode.remainingCount ?? 0)
  }

  return createCountConsumeSuccessResult(updatedCode)
}
