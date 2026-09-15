import {
  type LicenseActionCodeRecord,
  type LicenseConflictResolver,
} from './license-action-context'
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

function resolveBoundCodeUnavailableResult(activationCode: LicenseActionCodeRecord, now?: Date) {
  if (activationCode.licenseMode === 'COUNT' && (getRemainingCount(activationCode) ?? 0) <= 0) {
    return createCountExhaustedResult()
  }

  if (activationCode.licenseMode !== 'COUNT' && isCodeExpired(activationCode, now)) {
    return createExpiredResult()
  }

  return null
}

export async function resolveMutableLicenseActionCodeForMachine(params: {
  tx: AutoRebindMutationClient
  activationCode: LicenseActionCodeRecord | null
  machineId: string
  reloadActivationCode: () => Promise<LicenseActionCodeRecord | null>
  resolveProjectMachineConflict: LicenseConflictResolver // 保留契约，原子更新不再触发唯一约束冲突
  now?: Date
}): Promise<MutableCodeAccessResult> {
  const {
    tx,
    activationCode,
    machineId,
    reloadActivationCode,
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

  const unavailableResult = resolveBoundCodeUnavailableResult(activationCode, now)
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

  const updateResult = await tx.activationCode.updateMany({
    where: {
      id: activationCode.id,
      projectId: activationCode.projectId,
      // 原子条件：仅当仍绑定原设备且未被并发换绑过才递增换绑次数
      usedBy: activationCode.usedBy ?? null,
      lastRebindAt: activationCode.lastRebindAt ?? null,
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

  if (updateResult.count === 0) {
    // 并发换绑或设备状态已变化：重新读取最新记录后判定
    const latestActivationCode = await reloadActivationCode()
    if (!latestActivationCode) {
      return {
        result: createLicenseNotFoundResult(),
      }
    }

    if (latestActivationCode.usedBy === machineId) {
      return {
        activationCode: latestActivationCode,
      }
    }

    const latestUnavailableResult = resolveBoundCodeUnavailableResult(latestActivationCode, now)
    if (latestUnavailableResult) {
      return {
        result: latestUnavailableResult,
      }
    }

    const latestRebindPolicy = resolveEffectiveRebindPolicy(
      {
        allowAutoRebind: latestActivationCode.allowAutoRebind ?? null,
        autoRebindCooldownMinutes: latestActivationCode.autoRebindCooldownMinutes ?? null,
        autoRebindMaxCount: latestActivationCode.autoRebindMaxCount ?? null,
        project: latestActivationCode.project
          ? {
              allowAutoRebind: latestActivationCode.project.allowAutoRebind ?? null,
              autoRebindCooldownMinutes:
                latestActivationCode.project.autoRebindCooldownMinutes ?? null,
              autoRebindMaxCount: latestActivationCode.project.autoRebindMaxCount ?? null,
            }
          : null,
      },
      await getSystemRebindPolicyDefaults(),
    )

    const latestNextAllowedAt = getNextAllowedAutoRebindAt(
      latestActivationCode,
      latestRebindPolicy.autoRebindCooldownMinutes,
    )
    if (latestNextAllowedAt && latestNextAllowedAt.getTime() > now.getTime()) {
      const cooldownResult = createRebindCooldownResult(latestNextAllowedAt)
      cooldownResult.message = `激活码处于换绑冷却期，需等待 ${formatCooldownMinutesLabel(
        latestRebindPolicy.autoRebindCooldownMinutes,
      )}`

      return {
        result: cooldownResult,
      }
    }

    return {
      result: createUsedByOtherDeviceResult(),
    }
  }

  await recordActivationCodeBindingHistory(tx as DbClient, {
    activationCodeId: activationCode.id,
    projectId: activationCode.projectId,
    eventType: 'AUTO_REBIND',
    operatorType: 'CLIENT',
    fromMachineId: activationCode.usedBy,
    toMachineId: machineId,
  })

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
