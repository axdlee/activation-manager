import { type LicenseActionCodeRecord } from './license-action-context'
import { prepareMachineBindingForLicenseAction } from './license-binding-preflight-service'
import { loadLicenseActionCodeForMachine } from './license-code-access-service'
import { type DbClient } from './license-project-service'
import { type LicenseResult } from './license-result-service'
import { createLicenseTransactionHelpers } from './license-transaction-helpers'

type LicenseTransactionPreparationContext = {
  projectId: number
  code: string
  machineId: string
}

type LicenseTransactionHelpers = ReturnType<typeof createLicenseTransactionHelpers>

export type LicenseTransactionPreparationResult =
  | {
      result: LicenseResult
      activationCode?: never
      txHelpers?: never
    }
  | {
      result?: never
      activationCode: LicenseActionCodeRecord
      txHelpers: LicenseTransactionHelpers
    }

export async function prepareLicenseTransactionAction(
  client: DbClient,
  context: LicenseTransactionPreparationContext,
): Promise<LicenseTransactionPreparationResult> {
  const preflightResult = await prepareMachineBindingForLicenseAction(client, {
    projectId: context.projectId,
    machineId: context.machineId,
    targetCode: context.code,
  })

  if (preflightResult) {
    return {
      result: preflightResult,
    }
  }

  const txHelpers = createLicenseTransactionHelpers(client, context)
  const codeLoadResult = await loadLicenseActionCodeForMachine({
    machineId: context.machineId,
    reloadActivationCode: txHelpers.reloadActivationCode,
  })

  if (codeLoadResult.result) {
    return {
      result: codeLoadResult.result,
    }
  }

  return {
    activationCode: codeLoadResult.activationCode,
    txHelpers,
  }
}
