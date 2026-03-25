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
import {
  activateCountLicense,
  activateTimeLicense,
} from './license-activation-flow-service'
import {
  consumeCountLicense,
  consumeTimeLicense,
} from './license-consume-flow-service'
import {
  type LicenseResult,
} from './license-result-service'

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

  return client.$transaction(async (tx) => {
    const preparationResult = await prepareLicenseTransactionAction(tx, {
      projectId,
      code,
      machineId,
    })

    if (preparationResult.result) {
      return preparationResult.result
    }

    const { activationCode, txHelpers } = preparationResult

    if (activationCode.licenseMode === 'COUNT') {
      return activateCountLicense({
        tx,
        activationCode,
        machineId,
        resolveProjectMachineConflict: txHelpers.resolveProjectMachineConflict,
      })
    }

    return activateTimeLicense({
      tx,
      activationCode,
      machineId,
      resolveProjectMachineConflict: txHelpers.resolveProjectMachineConflict,
    })
  })
}

export async function consumeLicense(client: PrismaClient, input: ConsumeLicenseInput): Promise<LicenseResult> {
  const resolution = await resolveConsumeLicenseCommandContext(client, input)
  if (!resolution.ok) {
    return resolution.result
  }

  const { projectId, code, machineId, requestId, requestContext } = resolution.context

  return client.$transaction(async (tx) => {
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

    const { activationCode, txHelpers } = preparationResult

    if (activationCode.licenseMode === 'TIME') {
      return consumeTimeLicense({
        tx,
        activationCode,
        projectId,
        code,
        machineId,
        reloadActivationCode: txHelpers.reloadActivationCode,
        resolveProjectMachineConflict: txHelpers.resolveProjectMachineConflict,
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
          requestContext,
        )
        : undefined,
      rollbackClaimedRequestId: txHelpers.rollbackClaimedRequestId,
      reloadActivationCode: txHelpers.reloadActivationCode,
      persistConsumptionRemainingCount: txHelpers.persistConsumptionRemainingCount,
      resolveProjectMachineConflict: txHelpers.resolveProjectMachineConflict,
    })
  })
}

export async function verifyActivationCode(client: PrismaClient, input: LicenseActionInput): Promise<LicenseResult> {
  return consumeLicense(client, input)
}
