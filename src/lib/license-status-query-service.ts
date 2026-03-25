import { findProjectActivationCode } from './license-binding-service'
import { loadLicenseActionCodeForMachine } from './license-code-access-service'
import { type DbClient } from './license-project-service'
import {
  createLicenseStatusSuccessResult,
  type LicenseResult,
} from './license-result-service'

type LicenseStatusQueryContext = {
  projectId: number
  code: string
  machineId: string
}

export async function resolveLicenseStatusForMachine(
  client: DbClient,
  context: LicenseStatusQueryContext,
): Promise<LicenseResult> {
  const codeLoadResult = await loadLicenseActionCodeForMachine({
    machineId: context.machineId,
    reloadActivationCode: () => findProjectActivationCode(client, context.projectId, context.code),
  })

  if (codeLoadResult.result) {
    return codeLoadResult.result
  }

  return createLicenseStatusSuccessResult(codeLoadResult.activationCode)
}
