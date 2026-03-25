import { type LicenseActionCodeRecord } from './license-action-context'
import {
  createLicenseNotFoundResult,
  createUsedByOtherDeviceResult,
  type LicenseResult,
} from './license-result-service'

type LoadLicenseActionCodeForMachineParams = {
  machineId: string
  reloadActivationCode: () => Promise<LicenseActionCodeRecord | null>
}

export type LicenseActionCodeLoadResult =
  | {
      activationCode: LicenseActionCodeRecord
      result?: never
    }
  | {
      activationCode?: never
      result: LicenseResult
    }

export async function loadLicenseActionCodeForMachine(
  params: LoadLicenseActionCodeForMachineParams,
): Promise<LicenseActionCodeLoadResult> {
  const activationCode = await params.reloadActivationCode()

  if (!activationCode) {
    return {
      result: createLicenseNotFoundResult(),
    }
  }

  if (activationCode.usedBy && activationCode.usedBy !== params.machineId) {
    return {
      result: createUsedByOtherDeviceResult(),
    }
  }

  return {
    activationCode,
  }
}
