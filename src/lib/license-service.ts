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
  buildLicenseConsumptionRequestContext,
  type ConsumeLicenseInput,
  type LicenseActionInput,
  type LicenseStatusInput,
  normalizeConsumeLicenseInput,
  normalizeLicenseActionInput,
} from './license-action-context'
import { resolveProject } from './license-project-service'
import {
  claimConsumptionRequestId,
  resolveExistingConsumptionResult,
} from './license-consumption-idempotency-service'
import { loadLicenseActionCodeForMachine } from './license-code-access-service'
import { createLicenseTransactionHelpers } from './license-transaction-helpers'
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
  createLicenseStatusSuccessResult,
  createMissingParamsResult,
  type LicenseResult,
} from './license-result-service'

export async function getLicenseStatus(client: PrismaClient, input: LicenseStatusInput): Promise<LicenseResult> {
  const { projectKey, code, machineId } = normalizeLicenseActionInput(input)
  if (!code || !machineId) {
    return createMissingParamsResult()
  }

  const project = await resolveProject(client, projectKey)
  const txHelpers = createLicenseTransactionHelpers(client, {
    projectId: project.id,
    code,
    machineId,
  })
  const codeLoadResult = await loadLicenseActionCodeForMachine({
    machineId,
    reloadActivationCode: txHelpers.reloadActivationCode,
  })

  if (codeLoadResult.result) {
    return codeLoadResult.result
  }

  return createLicenseStatusSuccessResult(codeLoadResult.activationCode)
}

export async function activateLicense(client: PrismaClient, input: LicenseActionInput): Promise<LicenseResult> {
  const { projectKey, code, machineId } = normalizeLicenseActionInput(input)
  if (!code || !machineId) {
    return createMissingParamsResult()
  }

  const project = await resolveProject(client, projectKey)

  return client.$transaction(async (tx) => {
    const preparationResult = await prepareLicenseTransactionAction(tx, {
      projectId: project.id,
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
  const {
    projectKey,
    code,
    machineId,
    requestId,
  } = normalizeConsumeLicenseInput(input)

  if (!code || !machineId) {
    return createMissingParamsResult()
  }

  const project = await resolveProject(client, projectKey)
  const requestContext = buildLicenseConsumptionRequestContext({
    code,
    projectId: project.id,
    machineId,
  })

  return client.$transaction(async (tx) => {
    if (requestId) {
      const existingResult = await resolveExistingConsumptionResult(tx, requestId, requestContext)
      if (existingResult) {
        return existingResult
      }
    }

    const preparationResult = await prepareLicenseTransactionAction(tx, {
      projectId: project.id,
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
        projectId: project.id,
        code,
        machineId,
        reloadActivationCode: txHelpers.reloadActivationCode,
        resolveProjectMachineConflict: txHelpers.resolveProjectMachineConflict,
      })
    }

    return consumeCountLicense({
      tx,
      activationCode,
      projectId: project.id,
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
