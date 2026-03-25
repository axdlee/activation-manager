import {
  buildReusableConflictMessage,
  findMachineBinding,
  findProjectActivationCode,
} from './license-binding-service'
import { type DbClient } from './license-project-service'
import { type LicenseResult } from './license-result-service'

type LicenseTransactionHelperContext = {
  projectId: number
  code: string
  machineId: string
}

export function createLicenseTransactionHelpers(
  client: DbClient,
  context: LicenseTransactionHelperContext,
) {
  return {
    reloadActivationCode: () => findProjectActivationCode(client, context.projectId, context.code),
    resolveProjectMachineConflict: async (): Promise<LicenseResult> => {
      const existingBinding = await findMachineBinding(
        client,
        context.projectId,
        context.machineId,
      )

      if (existingBinding) {
        return {
          success: false,
          message: buildReusableConflictMessage(existingBinding),
          status: 400,
        }
      }

      return {
        success: false,
        message: '同一项目下每台设备只能使用一个有效激活码',
        status: 409,
      }
    },
    rollbackClaimedRequestId: async (requestId: string) => {
      await client.licenseConsumption.delete({
        where: {
          requestId,
        },
      })
    },
    persistConsumptionRemainingCount: async (
      requestId: string,
      remainingCountAfter: number,
    ) => {
      await client.licenseConsumption.update({
        where: {
          requestId,
        },
        data: {
          remainingCountAfter,
        },
      })
    },
  }
}
