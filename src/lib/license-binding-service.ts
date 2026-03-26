import {
  getRemainingCount,
  isCodeExpired,
} from './license-status'
import { recordActivationCodeBindingHistory } from './license-binding-history-service'
import { type DbClient } from './license-project-service'
import { isPrismaUniqueConstraintError } from './prisma-error-utils'

const PROJECT_MACHINE_UNIQUE_CONSTRAINT_FIELDS = ['projectId', 'usedBy'] as const

export function buildReusableConflictMessage(existingCode: {
  code: string
  licenseMode: string
  remainingCount: number | null
}) {
  if (existingCode.licenseMode === 'COUNT') {
    return `该设备已绑定激活码: ${existingCode.code}，请先用完剩余次数（剩余 ${existingCode.remainingCount ?? 0} 次）`
  }

  return `该设备已激活过激活码: ${existingCode.code}，同一项目下每台设备只能使用一个有效激活码`
}

export function canReuseProjectBinding(existingCode: {
  licenseMode: string
  remainingCount: number | null
  totalCount?: number | null
  isUsed: boolean
  usedAt: Date | null
  expiresAt: Date | null
  validDays: number | null
}) {
  if (existingCode.licenseMode === 'COUNT') {
    return (getRemainingCount(existingCode) ?? 0) <= 0
  }

  return isCodeExpired(existingCode)
}

export async function findProjectActivationCode(
  client: DbClient,
  projectId: number,
  code: string,
) {
  const activationCode = await client.activationCode.findUnique({
    where: {
      code,
    },
    include: {
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
    },
  })

  if (!activationCode || activationCode.projectId !== projectId) {
    return null
  }

  return activationCode
}

export async function findMachineBinding(
  client: DbClient,
  projectId: number,
  machineId: string,
) {
  return client.activationCode.findFirst({
    where: {
      projectId,
      usedBy: machineId,
      isUsed: true,
    },
    orderBy: {
      usedAt: 'desc',
    },
  })
}

export function isProjectMachineUniqueConstraintError(error: unknown) {
  return isPrismaUniqueConstraintError(error, PROJECT_MACHINE_UNIQUE_CONSTRAINT_FIELDS)
}

export async function releaseReusableMachineBindings(
  client: DbClient,
  projectId: number,
  machineId: string,
  targetCode: string,
) {
  const existingBindings = await client.activationCode.findMany({
    where: {
      projectId,
      usedBy: machineId,
      isUsed: true,
    },
  })

  const reusableBindings = existingBindings
    .filter((binding) => binding.code !== targetCode && canReuseProjectBinding(binding))
  const reusableBindingIds = reusableBindings.map((binding) => binding.id)

  if (reusableBindingIds.length === 0) {
    return
  }

  await client.activationCode.updateMany({
    where: {
      id: {
        in: reusableBindingIds,
      },
    },
    data: {
      usedBy: null,
    },
  })

  for (const binding of reusableBindings) {
    await recordActivationCodeBindingHistory(client, {
      activationCodeId: binding.id,
      projectId: binding.projectId,
      eventType: 'REUSABLE_BINDING_RELEASED',
      operatorType: 'SYSTEM',
      fromMachineId: machineId,
      toMachineId: null,
      reason: `为同项目激活码 ${targetCode} 释放已失效旧绑定`,
    })
  }
}
