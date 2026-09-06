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
import { recordActivationCodeBindingHistory } from './license-binding-history-service'

type ConsumeMutationClient = Pick<DbClient, 'activationCode'>

export async function consumeTimeLicense(params: {
  tx: ConsumeMutationClient
  activationCode: LicenseActionCodeRecord
  projectId: number
  code: string
  machineId: string
  reloadActivationCode: () => Promise<LicenseActionCodeRecord | null>
  resolveProjectMachineConflict: LicenseConflictResolver
  bindDevice?: boolean
}): Promise<LicenseResult> {
  const {
    tx,
    activationCode,
    machineId,
    reloadActivationCode,
    resolveProjectMachineConflict,
    bindDevice = true,
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
          ...(bindDevice ? { usedBy: machineId, lastBoundAt: now } : {}),
          expiresAt,
        },
      })

      const updatedCode = await reloadActivationCode()
      if (!updatedCode) {
        return createLicenseNotFoundResult()
      }

      if (updateResult.count === 0) {
        if (bindDevice && updatedCode.usedBy && updatedCode.usedBy !== machineId) {
          return createUsedByOtherDeviceResult()
        }

        if (isCodeExpired(updatedCode)) {
          return createExpiredResult()
        }
      }

      if (updateResult.count > 0 && bindDevice) {
        await recordActivationCodeBindingHistory(tx as DbClient, {
          activationCodeId: activationCode.id,
          projectId: params.projectId,
          eventType: 'INITIAL_BIND',
          operatorType: 'CLIENT',
          fromMachineId: activationCode.usedBy ?? null,
          toMachineId: machineId,
        })
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

  if (!activationCode.usedBy) {
    // 设备绑定已关闭：直接验证成功，不记录绑定
    if (!bindDevice) {
      return createTimeConsumeSuccessResult(activationCode)
    }

    const now = new Date()

    try {
      const updateResult = await tx.activationCode.updateMany({
        where: {
          id: activationCode.id,
          projectId: params.projectId,
          isUsed: true,
          usedBy: null,
        },
        data: {
          usedBy: machineId,
          lastBoundAt: now,
        },
      })

      const updatedCode = await reloadActivationCode()
      if (!updatedCode) {
        return createLicenseNotFoundResult()
      }

      if (updateResult.count === 0 && updatedCode.usedBy && updatedCode.usedBy !== machineId) {
        return createUsedByOtherDeviceResult()
      }

      if (updateResult.count > 0) {
        await recordActivationCodeBindingHistory(tx as DbClient, {
          activationCodeId: activationCode.id,
          projectId: params.projectId,
          eventType: 'INITIAL_BIND',
          operatorType: 'CLIENT',
          fromMachineId: activationCode.usedBy ?? null,
          toMachineId: machineId,
        })
      }

      return createTimeConsumeSuccessResult(updatedCode)
    } catch (error) {
      if (isProjectMachineUniqueConstraintError(error)) {
        return resolveProjectMachineConflict()
      }

      throw error
    }
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
  bindDevice?: boolean
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
    bindDevice = true,
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

  let updateResult: { count: number } | null = null
  try {
    updateResult = await tx.activationCode.updateMany({
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
        ...(bindDevice ? { usedBy: machineId } : {}),
        ...(bindDevice && activationCode.usedBy ? {} : { lastBoundAt: new Date() }),
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

      if (bindDevice && latestCode.usedBy && latestCode.usedBy !== machineId) {
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

  if (!activationCode.usedBy && (updateResult?.count ?? 0) > 0) {
    await recordActivationCodeBindingHistory(tx as DbClient, {
      activationCodeId: activationCode.id,
      projectId: params.projectId,
      eventType: 'INITIAL_BIND',
      operatorType: 'CLIENT',
      fromMachineId: null,
      toMachineId: machineId,
    })
  }

  return createCountConsumeSuccessResult(updatedCode)
}
