import {
  buildLicenseConsumptionRequestContext,
  type ConsumeLicenseInput,
  type LicenseActionInput,
  normalizeConsumeLicenseInput,
  normalizeLicenseActionInput,
} from './license-action-context'
import {
  resolveProject,
  type DbClient,
} from './license-project-service'
import {
  createMissingParamsResult,
  type LicenseResult,
} from './license-result-service'

export type ResolvedLicenseActionCommandContext = {
  projectId: number
  code: string
  machineId: string
}

export type ResolvedConsumeLicenseCommandContext = ResolvedLicenseActionCommandContext & {
  requestId?: string
  requestContext: {
    projectId: number
    code: string
    machineId: string
  }
}

type LicenseCommandContextResolution<TContext> =
  | {
    ok: false
    result: LicenseResult
  }
  | {
    ok: true
    context: TContext
  }

async function resolveBaseLicenseActionCommandContext(
  client: DbClient,
  input: LicenseActionInput,
): Promise<LicenseCommandContextResolution<ResolvedLicenseActionCommandContext>> {
  const { projectKey, code, machineId } = normalizeLicenseActionInput(input)

  if (!code || !machineId) {
    return {
      ok: false,
      result: createMissingParamsResult(),
    }
  }

  const project = await resolveProject(client, projectKey)

  return {
    ok: true,
    context: {
      projectId: project.id,
      code,
      machineId,
    },
  }
}

export async function resolveLicenseActionCommandContext(
  client: DbClient,
  input: LicenseActionInput,
): Promise<LicenseCommandContextResolution<ResolvedLicenseActionCommandContext>> {
  return resolveBaseLicenseActionCommandContext(client, input)
}

export async function resolveConsumeLicenseCommandContext(
  client: DbClient,
  input: ConsumeLicenseInput,
): Promise<LicenseCommandContextResolution<ResolvedConsumeLicenseCommandContext>> {
  const normalizedInput = normalizeConsumeLicenseInput(input)
  const baseResolution = await resolveBaseLicenseActionCommandContext(client, normalizedInput)

  if (!baseResolution.ok) {
    return baseResolution
  }

  const requestContext = buildLicenseConsumptionRequestContext(baseResolution.context)

  return {
    ok: true,
    context: {
      ...baseResolution.context,
      requestId: normalizedInput.requestId,
      requestContext,
    },
  }
}
