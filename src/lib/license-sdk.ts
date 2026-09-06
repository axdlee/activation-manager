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
  responseSecret?: string
  onRetry?: (event: LicenseClientRetryEvent) => void | Promise<void>
  onError?: (event: LicenseClientErrorEvent) => void | Promise<void>
  onSuccess?: (event: LicenseClientSuccessEvent) => void | Promise<void>
}

type JsonRecord = Record<string, unknown>
type LicenseClientErrorCode =
  | 'FETCH_UNAVAILABLE'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'INVALID_RESPONSE'
  | 'HTTP_ERROR'
  | 'RATE_LIMITED'
  | 'SIGNATURE_INVALID'

class LicenseClientError extends Error {
  readonly code: LicenseClientErrorCode
  readonly path: string
  readonly attemptCount: number
  readonly statusCode?: number
  readonly cause?: unknown

  constructor(
    message: string,
    options: {
      code: LicenseClientErrorCode
      path: string
      attemptCount: number
      statusCode?: number
      cause?: unknown
    },
  ) {
    super(message)
    this.name = 'LicenseClientError'
    this.code = options.code
    this.path = options.path
    this.attemptCount = options.attemptCount
    this.statusCode = options.statusCode
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
  statusCode?: number,
) {
  const messages: Record<LicenseClientErrorCode, string> = {
    FETCH_UNAVAILABLE: '当前环境不支持 fetch，请手动传入 fetch 实现',
    TIMEOUT: '请求超时',
    NETWORK_ERROR: '网络请求失败',
    INVALID_RESPONSE: '接口响应格式无效',
    HTTP_ERROR: '服务端返回错误状态码',
    RATE_LIMITED: '请求过于频繁，已被限流',
    SIGNATURE_INVALID: '接口响应签名校验失败，可能存在篡改',
  }

  return new LicenseClientError(messages[code], {
    code,
    path,
    attemptCount,
    statusCode,
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

async function callHookSafely(hookName: string, call: () => void | Promise<void>) {
  try {
    await call()
  } catch (error) {
    console.error(`[license-sdk] hook ${hookName} 执行出错（不影响主流程）:`, error)
  }
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

const LICENSE_SIGNATURE_HEADER = 'x-license-signature'
const LICENSE_TIMESTAMP_HEADER = 'x-license-timestamp'
const SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000

async function verifyLicenseResponseSignature(
  bodyText: string,
  response: Response,
  secret: string,
): Promise<boolean> {
  const signature = response.headers.get(LICENSE_SIGNATURE_HEADER)
  const timestamp = response.headers.get(LICENSE_TIMESTAMP_HEADER)

  if (!signature || !timestamp) {
    return false
  }

  const timestampMs = Number(timestamp)
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > SIGNATURE_MAX_AGE_MS) {
    return false
  }

  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return false
  }

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(bodyText),
    )
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')

    return expectedSignature === signature.toLowerCase()
  } catch {
    return false
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
    await callHookSafely('onError', () =>
      options.onError?.({
        ...createHookContext(path, requestBody, 1, totalAttempts),
        error,
      }),
    )
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

      // HTTP 429：被限流，归类为可辨识的限流错误，调用方可据此做退避
      if (response.status === 429) {
        const rateLimitedError = buildLicenseClientError('RATE_LIMITED', path, attemptCount, null, 429)
        await callHookSafely('onError', () =>
          options.onError?.({
            ...createHookContext(path, requestBody, attemptCount, totalAttempts),
            error: rateLimitedError,
          }),
        )
        throw rateLimitedError
      }

      // 5xx：服务端内部错误。若响应体为 JSON（业务错误语义），照常返回；
      // 若响应体不可解析（如网关 HTML），归类为 HTTP_ERROR。
      if (response.status >= 500) {
        const payloadText = await response.text()

        if (!payloadText) {
          const serverError = buildLicenseClientError('HTTP_ERROR', path, attemptCount, null, response.status)
          await callHookSafely('onError', () =>
            options.onError?.({
              ...createHookContext(path, requestBody, attemptCount, totalAttempts),
              error: serverError,
            }),
          )
          throw serverError
        }

        try {
          const payload = JSON.parse(payloadText) as unknown
          const normalizedResponse = normalizeLicenseApiResponse(payload, response.status)

          await callHookSafely('onSuccess', () =>
            options.onSuccess?.({
              ...createHookContext(path, requestBody, attemptCount, totalAttempts),
              response: normalizedResponse,
            }),
          )

          return normalizedResponse
        } catch (error) {
          const serverError = buildLicenseClientError('HTTP_ERROR', path, attemptCount, error, response.status)
          await callHookSafely('onError', () =>
            options.onError?.({
              ...createHookContext(path, requestBody, attemptCount, totalAttempts),
              error: serverError,
            }),
          )
          throw serverError
        }
      }

      let responsePayload: unknown

      try {
        const responseText = await response.text()
        if (options.responseSecret) {
          const signatureValid = await verifyLicenseResponseSignature(
            responseText,
            response,
            options.responseSecret,
          )
          if (!signatureValid) {
            throw buildLicenseClientError('SIGNATURE_INVALID', path, attemptCount, null, response.status)
          }
        }
        responsePayload = JSON.parse(responseText)
      } catch (error) {
        if (error instanceof LicenseClientError) {
          throw error
        }
        throw buildLicenseClientError('INVALID_RESPONSE', path, attemptCount, error)
      }

      const normalizedResponse = normalizeLicenseApiResponse(responsePayload, response.status)

      await callHookSafely('onSuccess', () =>
        options.onSuccess?.({
          ...createHookContext(path, requestBody, attemptCount, totalAttempts),
          response: normalizedResponse,
        }),
      )

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
        await callHookSafely('onRetry', () =>
          options.onRetry?.({
            ...createHookContext(path, requestBody, attemptCount, totalAttempts),
            error: normalizedError,
            nextAttemptCount: attemptCount + 1,
          }),
        )
        await sleep(retryDelayMs)
        continue
      }

      // 已经触发过 hook 的错误（429 / HTTP_ERROR / FETCH_UNAVAILABLE 已在上层分支处理），
      // 避免重复调用 onError。
      if (
        normalizedError.code === 'TIMEOUT' ||
        normalizedError.code === 'NETWORK_ERROR' ||
        normalizedError.code === 'INVALID_RESPONSE'
      ) {
        await callHookSafely('onError', () =>
          options.onError?.({
            ...createHookContext(path, requestBody, attemptCount, totalAttempts),
            error: normalizedError,
          }),
        )
      }

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
