import { type LicenseStatusLike } from './license-status'
import { type LicenseResult } from './license-result-service'

export type LicenseActionInput = {
  projectKey?: string
  code: string
  machineId: string
}

export type ConsumeLicenseInput = LicenseActionInput & {
  requestId?: string
}

export type LicenseStatusInput = LicenseActionInput

export type LicenseActionCodeRecord = LicenseStatusLike & {
  id: number
  code: string
  projectId: number
  createdAt?: Date | string | null
  licenseMode: string
  usedBy?: string | null
  lastBoundAt?: Date | string | null
  lastRebindAt?: Date | string | null
  rebindCount?: number
  autoRebindCount?: number
  allowAutoRebind?: boolean | null
  autoRebindCooldownMinutes?: number | null
  autoRebindMaxCount?: number | null
  project?: {
    id: number
    name: string
    projectKey: string
    allowAutoRebind?: boolean | null
    autoRebindCooldownMinutes?: number | null
    autoRebindMaxCount?: number | null
  } | null
}

export type LicenseConflictResolver = () => Promise<LicenseResult>

export type LicenseConsumptionRequestContext = {
  code: string
  projectId: number
  machineId: string
}

export type LicenseIdempotencyClaimResult = {
  claimed: boolean
  existingResult: LicenseResult | null
}

function normalizeOptionalText(value?: string) {
  const normalizedValue = value?.trim()
  return normalizedValue ? normalizedValue : undefined
}

export function normalizeLicenseActionInput(input: LicenseActionInput) {
  return {
    projectKey: normalizeOptionalText(input.projectKey),
    code: String(input.code || '').trim(),
    machineId: String(input.machineId || '').trim(),
  }
}

export function normalizeConsumeLicenseInput(input: ConsumeLicenseInput) {
  return {
    ...normalizeLicenseActionInput(input),
    requestId: normalizeOptionalText(input.requestId),
  }
}

export function buildLicenseConsumptionRequestContext(
  context: LicenseConsumptionRequestContext,
) {
  return {
    projectId: context.projectId,
    code: context.code,
    machineId: context.machineId,
  }
}
