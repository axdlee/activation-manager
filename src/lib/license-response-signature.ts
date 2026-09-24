import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * License API 响应签名：
 * 服务端签名、SDK 验签共用同一算法；未配置 secret 时不签名（向后兼容）。
 *
 * 版本演进：
 * - v1: HMAC(body, secret)——仅签 body，重放窗口只受时间戳头约束
 * - v2: HMAC(`${timestamp}.${body}`)——时间戳参与 HMAC 输入，阻断跨时间戳重放
 * - v3: HMAC(`${timestamp}.${code}|${machineId}.${body}`)——绑定请求上下文
 *   （激活码 + 机器码），持有合法授权的响应无法转发给其他 code/machineId 使用
 *
 * 版本协商：客户端通过请求头 `x-license-signature-version` 声明可验版本；
 * 未声明默认 v2（与 v2.9.0 行为一致）；声明 1/2/3 之外的值同样回落 v2。
 */

export const SIGNATURE_HEADER = 'x-license-signature'
export const TIMESTAMP_HEADER = 'x-license-timestamp'
export const SIGNATURE_VERSION_HEADER = 'x-license-signature-version'

export const SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000 // 5 分钟时间窗

/** 当前最新签名协议版本（SDK 升级后声明） */
export const LICENSE_SIGNATURE_CURRENT_VERSION = '3'

/** 未声明版本时的默认版本（v2.9.0 兼容基线） */
export const LICENSE_SIGNATURE_DEFAULT_VERSION = '2'

export type LicenseSignatureVersion = '1' | '2' | '3'

/** 响应签名绑定的请求上下文 */
export type LicenseSignatureContext = {
  code?: string
  machineId?: string
}

export function resolveResponseSignatureVersion(
  requested: string | null | undefined,
): LicenseSignatureVersion {
  if (requested === '1' || requested === '2' || requested === '3') {
    return requested
  }

  return LICENSE_SIGNATURE_DEFAULT_VERSION
}

function normalizeSignatureContextValue(value: string | undefined | null): string {
  return (value ?? '').trim()
}

/** v3 上下文串：`code|machineId`（与 SDK 端拼接规则保持一致） */
export function buildSignatureContextString(context: LicenseSignatureContext = {}): string {
  return `${normalizeSignatureContextValue(context.code)}|${normalizeSignatureContextValue(context.machineId)}`
}

export function signLicenseResponseBody(
  body: string,
  secret: string,
  timestamp: string | number,
  options: {
    version?: LicenseSignatureVersion
    context?: LicenseSignatureContext
  } = {},
): string {
  const { version = LICENSE_SIGNATURE_DEFAULT_VERSION, context } = options

  let payload: string
  if (version === '1') {
    payload = body
  } else if (version === '3') {
    payload = `${timestamp}.${buildSignatureContextString(context)}.${body}`
  } else {
    payload = `${timestamp}.${body}`
  }

  return createHmac('sha256', secret).update(payload).digest('hex')
}

export function verifyLicenseResponseSignature(params: {
  body: string
  signature: string
  timestamp: string
  secret: string
  version?: LicenseSignatureVersion
  context?: LicenseSignatureContext
  now?: number
}): boolean {
  const {
    body,
    signature,
    timestamp,
    secret,
    version = LICENSE_SIGNATURE_DEFAULT_VERSION,
    context,
    now = Date.now(),
  } = params

  if (!signature || !timestamp) {
    return false
  }

  const timestampMs = Number(timestamp)
  if (!Number.isFinite(timestampMs) || Math.abs(now - timestampMs) > SIGNATURE_MAX_AGE_MS) {
    return false
  }

  const expectedSignature = signLicenseResponseBody(body, secret, timestamp, { version, context })
  if (expectedSignature.length !== signature.length) {
    return false
  }

  const expectedBuffer = Buffer.from(expectedSignature, 'utf-8')
  const actualBuffer = Buffer.from(signature, 'utf-8')

  return timingSafeEqual(expectedBuffer, actualBuffer)
}

/** 测试辅助：构造（body, timestamp, 上下文）对应的合法签名 */
export function buildTestSignature(
  body: string,
  secret: string,
  timestamp: number,
  options: {
    version?: LicenseSignatureVersion
    context?: LicenseSignatureContext
  } = {},
) {
  return {
    signature: signLicenseResponseBody(body, secret, timestamp, options),
    timestamp: String(timestamp),
    version: options.version ?? LICENSE_SIGNATURE_DEFAULT_VERSION,
  }
}
