import { PrismaClient } from '@prisma/client'

export {
  getActivationCodeStats,
  getLicenseConsumptionTrend,
  listProjectStats,
} from './license-analytics-service'
export {
  listLicenseConsumptions,
  listLicenseConsumptionsPage,
} from './license-consumption-service'
export { generateActivationCodes } from './license-generation-service'
export {
  createProject,
  deleteProject,
  ensureDefaultProjectRecord,
  listProjects,
  updateProjectDescription,
  updateProjectName,
  updateProjectStatus,
} from './license-project-service'
import {
  type LicenseActionInput,
  type ConsumeLicenseInput,
  type LicenseStatusInput,
} from './license-action-context'
import {
  resolveConsumeLicenseCommandContext,
  resolveLicenseActionCommandContext,
} from './license-command-context-service'
import {
  claimConsumptionRequestId,
  resolveExistingConsumptionResult,
} from './license-consumption-idempotency-service'
import { resolveLicenseStatusForMachine } from './license-status-query-service'
import { prepareLicenseTransactionAction } from './license-transaction-preparation-service'
import { createLicenseTransactionHelpers } from './license-transaction-helpers'
import { isProjectMachineUniqueConstraintError } from './license-binding-service'
import { isPrismaUniqueConstraintError } from './prisma-error-utils'
import {
  activateCountLicense,
  activateTimeLicense,
} from './license-activation-flow-service'
import { resolveDeviceBindingEnabled } from './device-binding-config'
import {
  consumeCountLicense,
  consumeTimeLicense,
} from './license-consume-flow-service'
import {
  createPendingConsumptionRequestResult,
  type LicenseResult,
} from './license-result-service'

/**
 * 设备唯一键冲突的事务外解析：交互式事务因 P2002 失败后已被回滚
 * （PostgreSQL 事务一旦出错即中止，事务内不可继续查询），改用根连接
 * 读取已提交状态解析冲突，SQLite / PostgreSQL 行为一致。
 */
async function resolveMachineConflictOutsideTransaction(
  client: PrismaClient,
  context: { projectId: number; code: string; machineId: string },
): Promise<LicenseResult> {
  const helpers = createLicenseTransactionHelpers(client, context)
  return helpers.resolveProjectMachineConflict()
}

export async function getLicenseStatus(client: PrismaClient, input: LicenseStatusInput): Promise<LicenseResult> {
  const resolution = await resolveLicenseActionCommandContext(client, input)
  if (!resolution.ok) {
    return resolution.result
  }

  const { projectId, code, machineId } = resolution.context
  return resolveLicenseStatusForMachine(client, {
    projectId,
    code,
    machineId,
  })
}

export async function activateLicense(client: PrismaClient, input: LicenseActionInput): Promise<LicenseResult> {
  const resolution = await resolveLicenseActionCommandContext(client, input)
  if (!resolution.ok) {
    return resolution.result
  }

  const { projectId, code, machineId } = resolution.context
  const bindDevice = await resolveDeviceBindingEnabled()

  try {
    return await client.$transaction(async (tx) => {
      const preparationResult = await prepareLicenseTransactionAction(tx, {
        projectId,
        code,
        machineId,
      })

      if (preparationResult.result) {
        return preparationResult.result
      }

      const { activationCode } = preparationResult

      if (activationCode.licenseMode === 'COUNT') {
        return activateCountLicense({
          tx,
          activationCode,
          machineId,
          bindDevice,
        })
      }

      return activateTimeLicense({
        tx,
        activationCode,
        machineId,
        bindDevice,
      })
    })
  } catch (error) {
    if (isProjectMachineUniqueConstraintError(error)) {
      return resolveMachineConflictOutsideTransaction(client, { projectId, code, machineId })
    }

    throw error
  }
}

export async function consumeLicense(client: PrismaClient, input: ConsumeLicenseInput): Promise<LicenseResult> {
  const resolution = await resolveConsumeLicenseCommandContext(client, input)
  if (!resolution.ok) {
    return resolution.result
  }

  const { projectId, code, machineId, requestId, requestContext } = resolution.context
  const bindDevice = await resolveDeviceBindingEnabled()

  try {
    return await client.$transaction(async (tx) => {
      if (requestId) {
        const existingResult = await resolveExistingConsumptionResult(tx, requestId, requestContext)
        if (existingResult) {
          return existingResult
        }
      }

      const preparationResult = await prepareLicenseTransactionAction(tx, {
        projectId,
        code,
        machineId,
      })

      if (preparationResult.result) {
        return preparationResult.result
      }

      const { activationCode } = preparationResult

      if (activationCode.licenseMode === 'TIME') {
        return consumeTimeLicense({
          tx,
          activationCode,
          projectId,
          code,
          machineId,
          reloadActivationCode: preparationResult.txHelpers.reloadActivationCode,
          bindDevice,
        })
      }

      return consumeCountLicense({
        tx,
        activationCode,
        projectId,
        code,
        machineId,
        requestId,
        claimRequestId: requestId
          ? () => claimConsumptionRequestId(
            tx,
            {
              requestId,
              activationCodeId: activationCode.id,
              machineId,
            },
          )
          : undefined,
        rollbackClaimedRequestId: preparationResult.txHelpers.rollbackClaimedRequestId,
        reloadActivationCode: preparationResult.txHelpers.reloadActivationCode,
        persistConsumptionRemainingCount: preparationResult.txHelpers.persistConsumptionRemainingCount,
        bindDevice,
      })
    })
  } catch (error) {
    // 幂等键冲突：同 requestId 的消费已存在（并发重复提交）。事务已回滚，
    // 在事务外读取已提交的既有结果返回。
    if (requestId && isPrismaUniqueConstraintError(error, 'requestId')) {
      return (
        (await resolveExistingConsumptionResult(client, requestId, requestContext)) ??
        createPendingConsumptionRequestResult()
      )
    }

    if (isProjectMachineUniqueConstraintError(error)) {
      return resolveMachineConflictOutsideTransaction(client, { projectId, code, machineId })
    }

    throw error
  }
}

export async function verifyActivationCode(client: PrismaClient, input: LicenseActionInput): Promise<LicenseResult> {
  return consumeLicense(client, input)
}
