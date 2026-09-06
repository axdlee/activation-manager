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
  createUsedByOtherDeviceResult,
  type LicenseResult,
} from './license-result-service'
import { recordActivationCodeBindingHistory } from './license-binding-history-service'
import { type DbClient } from './license-project-service'

type ActivationMutationClient = Pick<DbClient, 'activationCode'>

/**
 * 尝试以原子方式占用激活码（仅当仍未被使用时）。
 * 返回 true 表示当前调用成功抢占；false 表示已被其他并发请求占用。
 */
async function tryClaimActivationCode(params: {
  tx: ActivationMutationClient
  activationCode: LicenseActionCodeRecord
  machineId: string
  isUsed: boolean
  usedBy: string | null
  usedAt: Date | string | null
  expiresAt?: Date | null
  bindDevice?: boolean
}): Promise<boolean> {
  const { tx, activationCode, machineId, bindDevice = true } = params

  const updateResult = await tx.activationCode.updateMany({
    where: {
      id: activationCode.id,
      projectId: activationCode.projectId,
      isUsed: params.isUsed,
      ...(params.isUsed ? { usedBy: params.usedBy } : {}),
    },
    data: {
      isUsed: true,
      usedAt: params.usedAt ?? new Date(),
      ...(bindDevice ? { usedBy: machineId, lastBoundAt: new Date() } : {}),
      ...(params.expiresAt === undefined ? {} : { expiresAt: params.expiresAt }),
    },
  })

  return updateResult.count === 1
}

export async function activateCountLicense(params: {
  tx: ActivationMutationClient
  activationCode: LicenseActionCodeRecord
  machineId: string
  resolveProjectMachineConflict: LicenseConflictResolver
  bindDevice?: boolean
}): Promise<LicenseResult> {
  const {
    tx,
    activationCode,
    machineId,
    resolveProjectMachineConflict,
    bindDevice = true,
  } = params

  const remainingCount = getRemainingCount(activationCode)
  if (!remainingCount || remainingCount <= 0) {
    return createCountExhaustedResult()
  }

  if (activationCode.isUsed && activationCode.usedBy === machineId) {
    return createActivationSuccessResult(activationCode, '激活码已激活')
  }

  const claimed = await tryClaimActivationCode({
    tx,
    activationCode,
    machineId,
    isUsed: false,
    usedBy: null,
    usedAt: activationCode.usedAt,
    bindDevice,
  }).catch((error) => {
    if (isProjectMachineUniqueConstraintError(error)) {
      return null
    }
    throw error
  })

  if (claimed === null) {
    return resolveProjectMachineConflict()
  }

  if (!claimed) {
    return createUsedByOtherDeviceResult()
  }

  if (bindDevice) {
    await recordActivationCodeBindingHistory(tx as DbClient, {
      activationCodeId: activationCode.id,
      projectId: activationCode.projectId,
      eventType: 'INITIAL_BIND',
      operatorType: 'CLIENT',
      fromMachineId: activationCode.usedBy ?? null,
      toMachineId: machineId,
    })
  }

  return createActivationSuccessResult(
    {
      isUsed: true,
      usedAt: activationCode.usedAt ?? new Date(),
      expiresAt: activationCode.expiresAt ?? null,
      validDays: activationCode.validDays,
      licenseMode: activationCode.licenseMode,
      totalCount: activationCode.totalCount,
      remainingCount: activationCode.remainingCount,
    },
    '激活码激活成功',
  )
}

export async function activateTimeLicense(params: {
  tx: ActivationMutationClient
  activationCode: LicenseActionCodeRecord
  machineId: string
  resolveProjectMachineConflict: LicenseConflictResolver
  bindDevice?: boolean
}): Promise<LicenseResult> {
  const {
    tx,
    activationCode,
    machineId,
    resolveProjectMachineConflict,
    bindDevice = true,
  } = params

  if (activationCode.isUsed && activationCode.usedBy === machineId) {
    if (isCodeExpired(activationCode)) {
      return createExpiredResult()
    }

    return createActivationSuccessResult(activationCode, '激活码已激活')
  }

  const now = new Date()

  if (activationCode.isUsed && !activationCode.usedBy) {
    if (isCodeExpired(activationCode)) {
      return createExpiredResult()
    }

    if (!bindDevice) {
      return createActivationSuccessResult(
        {
          isUsed: true,
          usedAt: activationCode.usedAt ?? new Date(),
          expiresAt: activationCode.expiresAt ?? null,
          validDays: activationCode.validDays,
          licenseMode: activationCode.licenseMode,
          totalCount: activationCode.totalCount,
          remainingCount: activationCode.remainingCount,
        },
        '激活码已激活',
      )
    }

    const claimed = await tryClaimActivationCode({
      tx,
      activationCode,
      machineId,
      isUsed: true,
      usedBy: null,
      usedAt: activationCode.usedAt,
      bindDevice,
    }).catch((error) => {
      if (isProjectMachineUniqueConstraintError(error)) {
        return null
      }
      throw error
    })

    if (claimed === null) {
      return resolveProjectMachineConflict()
    }

    if (!claimed) {
      return createUsedByOtherDeviceResult()
    }

    await recordActivationCodeBindingHistory(tx as DbClient, {
      activationCodeId: activationCode.id,
      projectId: activationCode.projectId,
      eventType: 'INITIAL_BIND',
      operatorType: 'CLIENT',
      fromMachineId: activationCode.usedBy ?? null,
      toMachineId: machineId,
    })

    return createActivationSuccessResult(
      {
        isUsed: true,
        usedAt: activationCode.usedAt ?? new Date(),
        expiresAt: activationCode.expiresAt ?? null,
        validDays: activationCode.validDays,
        licenseMode: activationCode.licenseMode,
        totalCount: activationCode.totalCount,
        remainingCount: activationCode.remainingCount,
      },
      '激活码绑定成功',
    )
  }

  const expiresAt = activationCode.validDays
    ? new Date(now.getTime() + activationCode.validDays * 24 * 60 * 60 * 1000)
    : null

  const claimed = await tryClaimActivationCode({
    tx,
    activationCode,
    machineId,
    isUsed: false,
    usedBy: null,
    usedAt: now,
    expiresAt,
    bindDevice,
  }).catch((error) => {
    if (isProjectMachineUniqueConstraintError(error)) {
      return null
    }
    throw error
  })

  if (claimed === null) {
    return resolveProjectMachineConflict()
  }

  if (!claimed) {
    return createUsedByOtherDeviceResult()
  }

  if (bindDevice) {
    await recordActivationCodeBindingHistory(tx as DbClient, {
      activationCodeId: activationCode.id,
      projectId: activationCode.projectId,
      eventType: 'INITIAL_BIND',
      operatorType: 'CLIENT',
      fromMachineId: activationCode.usedBy ?? null,
      toMachineId: machineId,
    })
  }

  return createActivationSuccessResult(
    {
      isUsed: true,
      usedAt: now,
      expiresAt,
      validDays: activationCode.validDays,
      licenseMode: activationCode.licenseMode,
      totalCount: activationCode.totalCount,
      remainingCount: activationCode.remainingCount,
    },
    '激活码激活成功',
  )
}
