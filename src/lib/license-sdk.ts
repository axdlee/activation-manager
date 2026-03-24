import type { LicenseModeValue } from '@/lib/license-status'

type LicenseApiPayload = {
  success: boolean
  message: string
  licenseMode: LicenseModeValue | null
  expiresAt: string | null
  remainingCount: number | null
  isActivated: boolean | null
  valid: boolean | null
  idempotent: boolean | null
  status: number
}

type LicenseRequestInput = {
  projectKey?: string
  code: string
  machineId: string
}

type ConsumeLicenseRequestInput = LicenseRequestInput & {
  requestId?: string
}

type LicenseClientRequestBody = {
  projectKey?: string
  code: string
  machineId: string
  requestId?: string
}

type LicenseClientHookContext = {
  path: string
  attemptCount: number
  totalAttempts: number
  requestBody: LicenseClientRequestBody
}

type LicenseClientRetryEvent = LicenseClientHookContext & {
  error: LicenseClientError
  nextAttemptCount: number
}

type LicenseClientErrorEvent = LicenseClientHookContext & {
  error: LicenseClientError
}

type LicenseClientSuccessEvent = LicenseClientHookContext & {
  response: LicenseApiPayload
}

type LicenseClientOptions = {
  baseUrl: string
  projectKey?: string
  fetch?: typeof fetch
  headers?: HeadersInit
  timeoutMs?: number
  maxRetries?: number
  retryDelayMs?: number
  onRetry?: (event: LicenseClientRetryEvent) => void | Promise<void>
  onError?: (event: LicenseClientErrorEvent) => void | Promise<void>
  onSuccess?: (event: LicenseClientSuccessEvent) => void | Promise<void>
}

type JsonRecord = Record<string, unknown>
type LicenseClientErrorCode = 'FETCH_UNAVAILABLE' | 'TIMEOUT' | 'NETWORK_ERROR' | 'INVALID_RESPONSE'

class LicenseClientError extends Error {
  readonly code: LicenseClientErrorCode
  readonly path: string
  readonly attemptCount: number
  readonly cause?: unknown

  constructor(
    message: string,
    options: {
      code: LicenseClientErrorCode
      path: string
      attemptCount: number
      cause?: unknown
    },
  ) {
    super(message)
    this.name = 'LicenseClientError'
    this.code = options.code
    this.path = options.path
    this.attemptCount = options.attemptCount
    this.cause = options.cause
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : null
}

function readNullableBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : null
}

function readNullableNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
}

function normalizePositiveNumber(value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null
  }

  return value
}

function normalizeRetryCount(value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return 0
  }

  return Math.floor(value)
}

function isAbortError(error: unknown) {
  return isRecord(error) && error.name === 'AbortError'
}

function buildLicenseClientError(
  code: LicenseClientErrorCode,
  path: string,
  attemptCount: number,
  cause?: unknown,
) {
  const messages: Record<LicenseClientErrorCode, string> = {
    FETCH_UNAVAILABLE: '当前环境不支持 fetch，请手动传入 fetch 实现',
    TIMEOUT: '请求超时',
    NETWORK_ERROR: '网络请求失败',
    INVALID_RESPONSE: '接口响应格式无效',
  }

  return new LicenseClientError(messages[code], {
    code,
    path,
    attemptCount,
    cause,
  })
}

function isRetryableTransportError(error: LicenseClientError) {
  return error.code === 'TIMEOUT' || error.code === 'NETWORK_ERROR'
}

function canRetryRequest(path: string, payload: ConsumeLicenseRequestInput) {
  if (path === '/api/license/consume') {
    return Boolean(payload.requestId)
  }

  return true
}

function sleep(delayMs: number) {
  if (delayMs <= 0) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    setTimeout(resolve, delayMs)
  })
}

function createRequestBody(
  defaults: Pick<LicenseClientOptions, 'projectKey'>,
  payload: ConsumeLicenseRequestInput,
): LicenseClientRequestBody {
  return {
    ...(defaults.projectKey || payload.projectKey
      ? {
          projectKey: payload.projectKey ?? defaults.projectKey,
        }
      : {}),
    code: payload.code,
    machineId: payload.machineId,
    ...(payload.requestId
      ? {
          requestId: payload.requestId,
        }
      : {}),
  }
}

export function normalizeLicenseApiResponse(payload: unknown, status: number): LicenseApiPayload {
  const normalizedPayload = isRecord(payload) ? payload : {}

  return {
    success: normalizedPayload.success === true,
    message: readString(normalizedPayload.message) ?? '',
    status,
    licenseMode:
      (readString(normalizedPayload.licenseMode) ?? readString(normalizedPayload.license_mode)) as LicenseModeValue | null,
    expiresAt: readString(normalizedPayload.expiresAt) ?? readString(normalizedPayload.expires_at),
    remainingCount:
      readNullableNumber(normalizedPayload.remainingCount) ?? readNullableNumber(normalizedPayload.remaining_count),
    isActivated:
      readNullableBoolean(normalizedPayload.isActivated) ?? readNullableBoolean(normalizedPayload.is_activated),
    valid: readNullableBoolean(normalizedPayload.valid),
    idempotent: readNullableBoolean(normalizedPayload.idempotent),
  }
}

export function isLicenseClientError(error: unknown): error is LicenseClientError {
  return error instanceof LicenseClientError
}

function createHookContext(
  path: string,
  requestBody: LicenseClientRequestBody,
  attemptCount: number,
  totalAttempts: number,
): LicenseClientHookContext {
  return {
    path,
    attemptCount,
    totalAttempts,
    requestBody,
  }
}

async function requestLicenseApi(
  options: LicenseClientOptions,
  path: string,
  payload: ConsumeLicenseRequestInput,
) {
  const requestBody = createRequestBody(options, payload)
  const totalAttempts = canRetryRequest(path, payload) ? normalizeRetryCount(options.maxRetries) + 1 : 1
  const fetcher = options.fetch ?? globalThis.fetch

  if (!fetcher) {
    const error = buildLicenseClientError('FETCH_UNAVAILABLE', path, 1)
    await options.onError?.({
      ...createHookContext(path, requestBody, 1, totalAttempts),
      error,
    })
    throw error
  }

  const url = `${normalizeBaseUrl(options.baseUrl)}${path}`
  const body = JSON.stringify(requestBody)
  const timeoutMs = normalizePositiveNumber(options.timeoutMs)
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? 0)

  for (let attemptCount = 1; attemptCount <= totalAttempts; attemptCount += 1) {
    const headers = new Headers(options.headers)
    headers.set('Content-Type', 'application/json')

    const controller = timeoutMs && typeof AbortController === 'function' ? new AbortController() : null
    const timeoutId =
      controller && timeoutMs
        ? setTimeout(() => {
            controller.abort()
          }, timeoutMs)
        : null

    try {
      const response = await fetcher(url, {
        method: 'POST',
        headers,
        body,
        ...(controller
          ? {
              signal: controller.signal,
            }
          : {}),
      })

      if (timeoutId) {
        clearTimeout(timeoutId)
      }

      let responsePayload: unknown

      try {
        responsePayload = await response.json()
      } catch (error) {
        throw buildLicenseClientError('INVALID_RESPONSE', path, attemptCount, error)
      }

      const normalizedResponse = normalizeLicenseApiResponse(responsePayload, response.status)

      await options.onSuccess?.({
        ...createHookContext(path, requestBody, attemptCount, totalAttempts),
        response: normalizedResponse,
      })

      return normalizedResponse
    } catch (error) {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }

      const normalizedError =
        error instanceof LicenseClientError
          ? error
          : isAbortError(error)
            ? buildLicenseClientError('TIMEOUT', path, attemptCount, error)
            : buildLicenseClientError('NETWORK_ERROR', path, attemptCount, error)

      if (attemptCount < totalAttempts && isRetryableTransportError(normalizedError)) {
        await options.onRetry?.({
          ...createHookContext(path, requestBody, attemptCount, totalAttempts),
          error: normalizedError,
          nextAttemptCount: attemptCount + 1,
        })
        await sleep(retryDelayMs)
        continue
      }

      await options.onError?.({
        ...createHookContext(path, requestBody, attemptCount, totalAttempts),
        error: normalizedError,
      })

      throw normalizedError
    }
  }

  throw buildLicenseClientError('NETWORK_ERROR', path, totalAttempts)
}

export function createLicenseClient(options: LicenseClientOptions) {
  return {
    activate(payload: LicenseRequestInput) {
      return requestLicenseApi(options, '/api/license/activate', payload)
    },
    status(payload: LicenseRequestInput) {
      return requestLicenseApi(options, '/api/license/status', payload)
    },
    consume(payload: ConsumeLicenseRequestInput) {
      return requestLicenseApi(options, '/api/license/consume', payload)
    },
  }
}

export type {
  ConsumeLicenseRequestInput,
  LicenseApiPayload,
  LicenseClientErrorEvent,
  LicenseClientErrorCode,
  LicenseClientOptions,
  LicenseClientRequestBody,
  LicenseClientRetryEvent,
  LicenseRequestInput,
  LicenseClientSuccessEvent,
}

export { LicenseClientError }
