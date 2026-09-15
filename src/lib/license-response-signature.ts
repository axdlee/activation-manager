import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * License API 响应签名：
 * HMAC-SHA256(body, secret)，配合时间戳防重放。
 * 服务端签名、SDK 验签共用同一算法；未配置 secret 时不签名（向后兼容）。
 */

export const SIGNATURE_HEADER = 'x-license-signature'
export const TIMESTAMP_HEADER = 'x-license-timestamp'

export const SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000 // 5 分钟时间窗

export function signLicenseResponseBody(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex')
}

export function verifyLicenseResponseSignature(params: {
  body: string
  signature: string
  timestamp: string
  secret: string
  now?: number
}): boolean {
  const { body, signature, timestamp, secret, now = Date.now() } = params

  if (!signature || !timestamp) {
    return false
  }

  const timestampMs = Number(timestamp)
  if (!Number.isFinite(timestampMs) || Math.abs(now - timestampMs) > SIGNATURE_MAX_AGE_MS) {
    return false
  }

  const expectedSignature = signLicenseResponseBody(body, secret)
  if (expectedSignature.length !== signature.length) {
    return false
  }

  const expectedBuffer = Buffer.from(expectedSignature, 'utf-8')
  const actualBuffer = Buffer.from(signature, 'utf-8')

  return timingSafeEqual(expectedBuffer, actualBuffer)
}

/** 测试辅助：构造一个（body, timestamp）对应的合法签名 */
export function buildTestSignature(body: string, secret: string, timestamp: number) {
  return {
    signature: signLicenseResponseBody(body, secret),
    timestamp: String(timestamp),
  }
}
