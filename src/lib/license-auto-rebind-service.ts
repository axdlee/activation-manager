import {
  type LicenseActionCodeRecord,
  type LicenseConflictResolver,
} from './license-action-context'
import { isProjectMachineUniqueConstraintError } from './license-binding-service'
import {
  formatCooldownMinutesLabel,
  getNextAllowedAutoRebindAt,
  getSystemRebindPolicyDefaults,
  resolveEffectiveRebindPolicy,
} from './license-rebind-policy'
import {
  createCountExhaustedResult,
  createExpiredResult,
  createLicenseNotFoundResult,
  createRebindCooldownResult,
  createRebindLimitReachedResult,
  createUsedByOtherDeviceResult,
  type LicenseResult,
} from './license-result-service'
import { getRemainingCount, isCodeExpired } from './license-status'
import { type DbClient } from './license-project-service'
import { recordActivationCodeBindingHistory } from './license-binding-history-service'

type AutoRebindMutationClient = Pick<DbClient, 'activationCode'>

type MutableCodeAccessResult =
  | {
      activationCode: LicenseActionCodeRecord
      result?: never
    }
  | {
      activationCode?: never
      result: LicenseResult
    }

function resolveBoundCodeUnavailableResult(activationCode: LicenseActionCodeRecord) {
  if (activationCode.licenseMode === 'COUNT' && (getRemainingCount(activationCode) ?? 0) <= 0) {
    return createCountExhaustedResult()
  }

  if (activationCode.licenseMode !== 'COUNT' && isCodeExpired(activationCode)) {
    return createExpiredResult()
  }

  return null
}

export async function resolveMutableLicenseActionCodeForMachine(params: {
  tx: AutoRebindMutationClient
  activationCode: LicenseActionCodeRecord | null
  machineId: string
  reloadActivationCode: () => Promise<LicenseActionCodeRecord | null>
  resolveProjectMachineConflict: LicenseConflictResolver
  now?: Date
}): Promise<MutableCodeAccessResult> {
  const {
    tx,
    activationCode,
    machineId,
    reloadActivationCode,
    resolveProjectMachineConflict,
    now = new Date(),
  } = params

  if (!activationCode) {
    return {
      result: createLicenseNotFoundResult(),
    }
  }

  if (!activationCode.usedBy || activationCode.usedBy === machineId) {
    return {
      activationCode,
    }
  }

  const unavailableResult = resolveBoundCodeUnavailableResult(activationCode)
  if (unavailableResult) {
    return {
      result: unavailableResult,
    }
  }

  const rebindPolicy = resolveEffectiveRebindPolicy(
    {
      allowAutoRebind: activationCode.allowAutoRebind ?? null,
      autoRebindCooldownMinutes: activationCode.autoRebindCooldownMinutes ?? null,
      autoRebindMaxCount: activationCode.autoRebindMaxCount ?? null,
      project: activationCode.project
        ? {
            allowAutoRebind: activationCode.project.allowAutoRebind ?? null,
            autoRebindCooldownMinutes:
              activationCode.project.autoRebindCooldownMinutes ?? null,
            autoRebindMaxCount: activationCode.project.autoRebindMaxCount ?? null,
          }
        : null,
    },
    await getSystemRebindPolicyDefaults(),
  )

  if (!rebindPolicy.allowAutoRebind) {
    return {
      result: createUsedByOtherDeviceResult(),
    }
  }

  const currentAutoRebindCount = activationCode.autoRebindCount ?? 0
  if (
    rebindPolicy.autoRebindMaxCount > 0 &&
    currentAutoRebindCount >= rebindPolicy.autoRebindMaxCount
  ) {
    return {
      result: createRebindLimitReachedResult(),
    }
  }

  const nextAllowedAutoRebindAt = getNextAllowedAutoRebindAt(
    activationCode,
    rebindPolicy.autoRebindCooldownMinutes,
  )

  if (nextAllowedAutoRebindAt && nextAllowedAutoRebindAt.getTime() > now.getTime()) {
    const cooldownResult = createRebindCooldownResult(nextAllowedAutoRebindAt)
    cooldownResult.message = `激活码处于换绑冷却期，需等待 ${formatCooldownMinutesLabel(
      rebindPolicy.autoRebindCooldownMinutes,
    )}`

    return {
      result: cooldownResult,
    }
  }

  try {
    await tx.activationCode.update({
      where: {
        id: activationCode.id,
      },
      data: {
        usedBy: machineId,
        lastBoundAt: now,
        lastRebindAt: now,
        rebindCount: {
          increment: 1,
        },
        autoRebindCount: {
          increment: 1,
        },
      },
    })
    await recordActivationCodeBindingHistory(tx as DbClient, {
      activationCodeId: activationCode.id,
      projectId: activationCode.projectId,
      eventType: 'AUTO_REBIND',
      operatorType: 'CLIENT',
      fromMachineId: activationCode.usedBy,
      toMachineId: machineId,
    })
  } catch (error) {
    if (isProjectMachineUniqueConstraintError(error)) {
      return {
        result: await resolveProjectMachineConflict(),
      }
    }

    throw error
  }

  const updatedActivationCode = await reloadActivationCode()
  if (!updatedActivationCode) {
    return {
      result: createLicenseNotFoundResult(),
    }
  }

  return {
    activationCode: updatedActivationCode,
  }
}
