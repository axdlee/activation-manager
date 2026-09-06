import { NextResponse } from 'next/server'

import {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  signLicenseResponseBody,
} from './license-response-signature'

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
  responseSecret?: string,
) {
  const body = JSON.stringify(buildLicenseResponsePayload(result, options))

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (responseSecret) {
    const timestamp = String(Date.now())
    headers[SIGNATURE_HEADER] = signLicenseResponseBody(body, responseSecret)
    headers[TIMESTAMP_HEADER] = timestamp
  }

  return new NextResponse(body, {
    status: result.status,
    headers,
  })
}

export function createLicenseResponse(
  result: LicenseApiResult,
  responseSecret?: string,
) {
  return createLicenseJsonResponse(result, {}, responseSecret)
}

export function createLegacyLicenseResponse(
  result: LicenseApiResult,
  responseSecret?: string,
) {
  return createLicenseJsonResponse(result, { legacyOnly: true }, responseSecret)
}

export function createLicenseErrorResponse(message: string, error: unknown) {
  console.error(`${message}:`, error)

  // 内部错误（throw 的 Error）不暴露具体消息给客户端，避免泄露内部细节。
  // 领域错误（如参数校验失败）应通过 LicenseResult 返回，不走此路径。
  return NextResponse.json(
    {
      success: false,
      message: '服务器内部错误',
    },
    { status: 500 },
  )
}
