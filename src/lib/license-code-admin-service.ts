import { Prisma, PrismaClient } from '@prisma/client'

import { recordAdminOperationAuditLog } from './admin-operation-audit-service'
import { DEFAULT_PROJECT_KEY } from './dev-bootstrap'
import { prepareMachineBindingForLicenseAction } from './license-binding-preflight-service'
import { isProjectMachineUniqueConstraintError } from './license-binding-service'
import { recordActivationCodeBindingHistory } from './license-binding-history-service'
import {
  normalizeNullableBooleanOverride,
  normalizeNullableCooldownMinutesOverride,
  normalizeNullableMaxCountOverride,
} from './license-rebind-policy'

type DbClient = PrismaClient | Prisma.TransactionClient

type UpdateActivationCodeRebindSettingsInput = {
  id: number
  allowAutoRebind?: boolean | null
  autoRebindCooldownMinutes?: number | null
  autoRebindMaxCount?: number | null
  adminUsername?: string
  reason?: string
}

type ForceUnbindActivationCodeInput = {
  id: number
  adminUsername?: string
  reason?: string
}

type ForceRebindActivationCodeInput = {
  id: number
  machineId: string
  adminUsername?: string
  reason?: string
}

function normalizeMachineId(machineId: string) {
  const normalizedMachineId = machineId.trim()

  if (!normalizedMachineId) {
    throw new Error('machineId 不能为空')
  }

  return normalizedMachineId
}

function includeProjectRebindSettings() {
  return {
    project: {
      select: {
        id: true,
        name: true,
        projectKey: true,
        allowAutoRebind: true,
        autoRebindCooldownMinutes: true,
        autoRebindMaxCount: true,
      },
    },
  } as const
}

async function getActivationCodeById(client: DbClient, id: number) {
  const activationCode = await client.activationCode.findUnique({
    where: { id },
    include: includeProjectRebindSettings(),
  })

  if (!activationCode) {
    throw new Error('激活码不存在')
  }

  return activationCode
}

export async function updateActivationCodeRebindSettings(
  client: DbClient,
  input: UpdateActivationCodeRebindSettingsInput,
) {
  const activationCode = await getActivationCodeById(client, input.id)

  const updatedActivationCode = await client.activationCode.update({
    where: {
      id: input.id,
    },
    data: {
      allowAutoRebind: normalizeNullableBooleanOverride(input.allowAutoRebind),
      autoRebindCooldownMinutes: normalizeNullableCooldownMinutesOverride(
        input.autoRebindCooldownMinutes,
      ),
      autoRebindMaxCount: normalizeNullableMaxCountOverride(input.autoRebindMaxCount),
    },
    include: includeProjectRebindSettings(),
  })

  if (input.adminUsername) {
    await recordAdminOperationAuditLog(client, {
      adminUsername: input.adminUsername,
      operationType: 'CODE_REBIND_SETTINGS_UPDATED',
      activationCodeId: activationCode.id,
      projectId: activationCode.projectId,
      targetLabel: activationCode.code,
      reason: input.reason,
      detail: {
        allowAutoRebind: updatedActivationCode.allowAutoRebind,
        autoRebindCooldownMinutes: updatedActivationCode.autoRebindCooldownMinutes,
        autoRebindMaxCount: updatedActivationCode.autoRebindMaxCount,
      },
    })
  }

  return updatedActivationCode
}

export async function forceUnbindActivationCode(
  client: PrismaClient,
  input: ForceUnbindActivationCodeInput,
) {
  return client.$transaction(async (tx) => {
    const activationCode = await getActivationCodeById(tx as Prisma.TransactionClient, input.id)

    if (!activationCode.usedBy) {
      return activationCode
    }

    const updatedActivationCode = await tx.activationCode.update({
      where: {
        id: activationCode.id,
      },
      data: {
        usedBy: null,
      },
      include: includeProjectRebindSettings(),
    })

    await recordActivationCodeBindingHistory(tx as Prisma.TransactionClient, {
      activationCodeId: activationCode.id,
      projectId: activationCode.projectId,
      eventType: 'FORCE_UNBIND',
      operatorType: 'ADMIN',
      operatorUsername: input.adminUsername,
      fromMachineId: activationCode.usedBy,
      toMachineId: null,
      reason: input.reason,
    })

    if (input.adminUsername) {
      await recordAdminOperationAuditLog(tx as Prisma.TransactionClient, {
        adminUsername: input.adminUsername,
        operationType: 'CODE_FORCE_UNBIND',
        activationCodeId: activationCode.id,
        projectId: activationCode.projectId,
        targetLabel: activationCode.code,
        reason: input.reason,
        detail: {
          fromMachineId: activationCode.usedBy,
        },
      })
    }

    return updatedActivationCode
  })
}

export async function forceRebindActivationCode(
  client: PrismaClient,
  input: ForceRebindActivationCodeInput,
) {
  const machineId = normalizeMachineId(input.machineId)

  return client.$transaction(async (tx) => {
    const activationCode = await getActivationCodeById(tx as Prisma.TransactionClient, input.id)

    if (activationCode.project.projectKey === DEFAULT_PROJECT_KEY && activationCode.projectId <= 0) {
      throw new Error('默认项目配置异常')
    }

    if (!activationCode.isUsed && !activationCode.usedBy) {
      throw new Error('未激活激活码请由客户端首次 activate 完成绑定')
    }

    if (activationCode.usedBy === machineId) {
      return activationCode
    }

    const preflightResult = await prepareMachineBindingForLicenseAction(tx, {
      projectId: activationCode.projectId,
      machineId,
      targetCode: activationCode.code,
    })

    if (preflightResult) {
      throw new Error(preflightResult.message)
    }

    const now = new Date()

    try {
      const updatedActivationCode = await tx.activationCode.update({
        where: {
          id: activationCode.id,
        },
        data: {
          usedBy: machineId,
          lastBoundAt: now,
          ...(activationCode.usedBy
            ? {
                lastRebindAt: now,
                rebindCount: {
                  increment: 1,
                },
              }
            : {}),
        },
        include: includeProjectRebindSettings(),
      })

      await recordActivationCodeBindingHistory(tx as Prisma.TransactionClient, {
        activationCodeId: activationCode.id,
        projectId: activationCode.projectId,
        eventType: 'FORCE_REBIND',
        operatorType: 'ADMIN',
        operatorUsername: input.adminUsername,
        fromMachineId: activationCode.usedBy,
        toMachineId: machineId,
        reason: input.reason,
      })

      if (input.adminUsername) {
        await recordAdminOperationAuditLog(tx as Prisma.TransactionClient, {
          adminUsername: input.adminUsername,
          operationType: 'CODE_FORCE_REBIND',
          activationCodeId: activationCode.id,
          projectId: activationCode.projectId,
          targetLabel: activationCode.code,
          reason: input.reason,
          detail: {
            fromMachineId: activationCode.usedBy,
            toMachineId: machineId,
          },
        })
      }

      return updatedActivationCode
    } catch (error) {
      if (isProjectMachineUniqueConstraintError(error)) {
        throw new Error('目标设备在当前项目下已绑定其他有效激活码')
      }

      throw error
    }
  })
}
