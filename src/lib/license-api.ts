import { NextResponse } from 'next/server'

type LicenseApiResult = {
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

function normalizeOptionalString(value: unknown) {
  if (value === undefined || value === null) {
    return undefined
  }

  const normalizedValue = String(value).trim()
  return normalizedValue || undefined
}

export async function readLicenseRequest(request: Request) {
  const payload = await request.json()

  return {
    projectKey: normalizeOptionalString(payload?.projectKey ?? payload?.project_key),
    code: normalizeOptionalString(payload?.code) ?? '',
    machineId: normalizeOptionalString(payload?.machineId ?? payload?.machine_id) ?? '',
    requestId: normalizeOptionalString(payload?.requestId ?? payload?.request_id),
  }
}

function buildLicenseResponsePayload(
  result: LicenseApiResult,
  options: {
    legacyOnly?: boolean
  } = {},
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

export function createLicenseResponse(result: LicenseApiResult) {
  return NextResponse.json(buildLicenseResponsePayload(result), { status: result.status })
}

export function createLegacyLicenseResponse(result: LicenseApiResult) {
  return NextResponse.json(
    buildLicenseResponsePayload(result, { legacyOnly: true }),
    { status: result.status },
  )
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
