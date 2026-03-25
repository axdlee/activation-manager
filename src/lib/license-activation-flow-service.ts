import { getRemainingCount, isCodeExpired } from './license-status'
import { isProjectMachineUniqueConstraintError } from './license-binding-service'
import {
  type LicenseActionCodeRecord,
  type LicenseConflictResolver,
} from './license-action-context'
import {
  createActivationSuccessResult,
  createCountExhaustedResult,
  createExpiredResult,
  type LicenseResult,
} from './license-result-service'
import { type DbClient } from './license-project-service'

type ActivationMutationClient = Pick<DbClient, 'activationCode'>

export async function activateCountLicense(params: {
  tx: ActivationMutationClient
  activationCode: LicenseActionCodeRecord
  machineId: string
  resolveProjectMachineConflict: LicenseConflictResolver
}): Promise<LicenseResult> {
  const {
    tx,
    activationCode,
    machineId,
    resolveProjectMachineConflict,
  } = params

  const remainingCount = getRemainingCount(activationCode)
  if (!remainingCount || remainingCount <= 0) {
    return createCountExhaustedResult()
  }

  if (activationCode.isUsed && activationCode.usedBy === machineId) {
    return createActivationSuccessResult(activationCode, '激活码已激活')
  }

  const now = new Date()

  try {
    const updatedCode = await tx.activationCode.update({
      where: {
        id: activationCode.id,
      },
      data: {
        isUsed: true,
        usedAt: activationCode.usedAt ?? now,
        usedBy: machineId,
      },
    })

    return createActivationSuccessResult(updatedCode, '激活码激活成功')
  } catch (error) {
    if (isProjectMachineUniqueConstraintError(error)) {
      return resolveProjectMachineConflict()
    }

    throw error
  }
}

export async function activateTimeLicense(params: {
  tx: ActivationMutationClient
  activationCode: LicenseActionCodeRecord
  machineId: string
  resolveProjectMachineConflict: LicenseConflictResolver
}): Promise<LicenseResult> {
  const {
    tx,
    activationCode,
    machineId,
    resolveProjectMachineConflict,
  } = params

  if (activationCode.isUsed && activationCode.usedBy === machineId) {
    if (isCodeExpired(activationCode)) {
      return createExpiredResult()
    }

    return createActivationSuccessResult(activationCode, '激活码已激活')
  }

  const now = new Date()
  const expiresAt = activationCode.validDays
    ? new Date(now.getTime() + activationCode.validDays * 24 * 60 * 60 * 1000)
    : null

  try {
    const updatedCode = await tx.activationCode.update({
      where: {
        id: activationCode.id,
      },
      data: {
        isUsed: true,
        usedAt: now,
        usedBy: machineId,
        expiresAt,
      },
    })

    return createActivationSuccessResult(updatedCode, '激活码激活成功')
  } catch (error) {
    if (isProjectMachineUniqueConstraintError(error)) {
      return resolveProjectMachineConflict()
    }

    throw error
  }
}
