import {
  buildReusableConflictMessage,
  canReuseProjectBinding,
  findMachineBinding,
  releaseReusableMachineBindings,
} from './license-binding-service'
import { type DbClient } from './license-project-service'
import { type LicenseResult } from './license-result-service'

export async function prepareMachineBindingForLicenseAction(
  client: DbClient,
  params: {
    projectId: number
    machineId: string
    targetCode: string
  },
): Promise<LicenseResult | null> {
  const existingBinding = await findMachineBinding(client, params.projectId, params.machineId)

  if (!existingBinding || existingBinding.code === params.targetCode) {
    return null
  }

  if (!canReuseProjectBinding(existingBinding)) {
    return {
      success: false,
      message: buildReusableConflictMessage(existingBinding),
      status: 400,
    }
  }

  await releaseReusableMachineBindings(
    client,
    params.projectId,
    params.machineId,
    params.targetCode,
  )

  return null
}
