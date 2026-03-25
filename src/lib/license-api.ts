import { NextResponse } from 'next/server'

export type LicenseApiResult = {
  success: boolean
  message: string
  status: number
  licenseMode?: string
  expiresAt?: Date | null
  remainingCount?: number | null
  isActivated?: boolean
  valid?: boolean
  idempotent?: boolean
}

export type LicenseApiRequestParams = {
  projectKey?: string
  code: string
  machineId: string
  requestId?: string
}

type LicenseApiResponseOptions = {
  legacyOnly?: boolean
}

function normalizeOptionalString(value: unknown) {
  if (value === undefined || value === null) {
    return undefined
  }

  const normalizedValue = String(value).trim()
  return normalizedValue || undefined
}

export function normalizeLicenseRequestPayload(payload: unknown): LicenseApiRequestParams {
  const requestPayload = payload as Record<string, unknown> | null | undefined

  return {
    projectKey: normalizeOptionalString(requestPayload?.projectKey ?? requestPayload?.project_key),
    code: normalizeOptionalString(requestPayload?.code) ?? '',
    machineId: normalizeOptionalString(requestPayload?.machineId ?? requestPayload?.machine_id) ?? '',
    requestId: normalizeOptionalString(requestPayload?.requestId ?? requestPayload?.request_id),
  }
}

export async function readLicenseRequest(request: Request) {
  return normalizeLicenseRequestPayload(await request.json())
}

function buildLicenseResponsePayload(
  result: LicenseApiResult,
  options: LicenseApiResponseOptions = {},
) {
  const sharedPayload = {
    success: result.success,
    message: result.message,
    expires_at: result.expiresAt ?? null,
    remaining_count: result.remainingCount ?? null,
    license_mode: result.licenseMode ?? null,
  }

  if (options.legacyOnly) {
    return sharedPayload
  }

  return {
    ...sharedPayload,
    licenseMode: result.licenseMode ?? null,
    expiresAt: result.expiresAt ?? null,
    remainingCount: result.remainingCount ?? null,
    isActivated: result.isActivated ?? null,
    is_activated: result.isActivated ?? null,
    valid: result.valid ?? null,
    idempotent: result.idempotent ?? null,
  }
}

export function createLicenseJsonResponse(
  result: LicenseApiResult,
  options: LicenseApiResponseOptions = {},
) {
  return NextResponse.json(buildLicenseResponsePayload(result, options), { status: result.status })
}

export function createLicenseResponse(result: LicenseApiResult) {
  return createLicenseJsonResponse(result)
}

export function createLegacyLicenseResponse(result: LicenseApiResult) {
  return createLicenseJsonResponse(result, { legacyOnly: true })
}

export function createLicenseErrorResponse(message: string, error: unknown) {
  console.error(`${message}:`, error)

  if (error instanceof Error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message,
      },
      { status: 400 },
    )
  }

  return NextResponse.json(
    {
      success: false,
      message: '服务器内部错误',
    },
    { status: 500 },
  )
}
