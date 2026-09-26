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
 * - v4: HMAC(`${timestamp}.${code}|${machineId}|${requestId}.${body}`)——在 v3 基础上
 *   绑定 requestId，同码同机 5 分钟窗口内无法用旧的扣次成功响应冒充新请求
 *
 * 版本协商：客户端通过请求头 `x-license-signature-version` 声明可验版本；
 * 未声明默认 v2（v2.9.0 之前 SDK 的兼容基线）；声明 2/3/4 之外的值（含已下线的 v1）
 * 同样回落 v2。v1 不签时间戳、可被无限期重放，服务端不再签发。
 *
 * 防降级：签名版本由客户端声明、服务端回显，攻击者可以自己请求低版本签名再转发。
 * 因此 SDK 必须只按「自己请求的版本」验签，响应头声明其他版本一律判失败——
 * 服务端的回落逻辑只服务于未升级的旧 SDK。
 */

export const SIGNATURE_HEADER = 'x-license-signature'
export const TIMESTAMP_HEADER = 'x-license-timestamp'
export const SIGNATURE_VERSION_HEADER = 'x-license-signature-version'

export const SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000 // 5 分钟时间窗

/** 当前最新签名协议版本（SDK 升级后声明） */
export const LICENSE_SIGNATURE_CURRENT_VERSION = '4'

/** 未声明版本时的默认版本（v2.9.0 兼容基线） */
export const LICENSE_SIGNATURE_DEFAULT_VERSION = '2'

/** 服务端可签发的版本（v1 已下线） */
export type LicenseSignatureVersion = '2' | '3' | '4'

/** 响应签名绑定的请求上下文 */
export type LicenseSignatureContext = {
  code?: string
  machineId?: string
  /** 仅 v4 参与签名；请求未携带时按空串处理 */
  requestId?: string
}

export function resolveResponseSignatureVersion(
  requested: string | null | undefined,
): LicenseSignatureVersion {
  if (requested === '2' || requested === '3' || requested === '4') {
    return requested
  }

  return LICENSE_SIGNATURE_DEFAULT_VERSION
}

function normalizeSignatureContextValue(value: string | undefined | null): string {
  return (value ?? '').trim()
}

/**
 * 上下文串（与 SDK 端拼接规则保持一致）：
 * - v3: `code|machineId`
 * - v4: `code|machineId|requestId`
 */
export function buildSignatureContextString(
  context: LicenseSignatureContext = {},
  version: '3' | '4' = '3',
): string {
  const base = `${normalizeSignatureContextValue(context.code)}|${normalizeSignatureContextValue(context.machineId)}`
  return version === '4' ? `${base}|${normalizeSignatureContextValue(context.requestId)}` : base
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

  const payload =
    version === '3' || version === '4'
      ? `${timestamp}.${buildSignatureContextString(context, version)}.${body}`
      : `${timestamp}.${body}`

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
