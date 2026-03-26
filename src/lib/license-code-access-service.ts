import { type LicenseActionCodeRecord } from './license-action-context'
import {
  createCountExhaustedResult,
  createExpiredResult,
  createLicenseNotFoundResult,
  createUsedByOtherDeviceResult,
  type LicenseResult,
} from './license-result-service'
import { getRemainingCount, isCodeExpired } from './license-status'

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
    if (activationCode.licenseMode === 'COUNT' && (getRemainingCount(activationCode) ?? 0) <= 0) {
      return {
        result: createCountExhaustedResult(),
      }
    }

    if (activationCode.licenseMode !== 'COUNT' && isCodeExpired(activationCode)) {
      return {
        result: createExpiredResult(),
      }
    }

    return {
      result: createUsedByOtherDeviceResult(),
    }
  }

  return {
    activationCode,
  }
}
