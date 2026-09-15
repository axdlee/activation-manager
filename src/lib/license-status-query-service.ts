import { findProjectActivationCode } from './license-binding-service'
import { loadLicenseActionCodeForMachine } from './license-code-access-service'
import { notifyLicenseExpiry } from './license-expiry-notification-service'
import { type DbClient } from './license-project-service'
import { isCodeExpired, getRemainingCount } from './license-status'
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

  const activationCode = codeLoadResult.activationCode

  // 到期通知：TIME 型已过期或 COUNT 型次数耗尽时触发（fire-and-forget + 去重）
  const isExpired =
    activationCode.licenseMode !== 'COUNT' && isCodeExpired(activationCode)
  const isDepleted =
    activationCode.licenseMode === 'COUNT' && (getRemainingCount(activationCode) ?? 0) <= 0
  if (isExpired || isDepleted) {
    notifyLicenseExpiry(activationCode)
  }

  return createLicenseStatusSuccessResult(activationCode)
}
