/**
 * 支付渠道配置的敏感字段脱敏：
 * - GET 回显用掩码替换密钥值，避免 secret/key 明文出现在响应里
 * - POST 保存时把掩码占位还原为存量值，避免「查看后保存」把密钥冲掉
 */

export const PAYMENT_CONFIG_MASK = '******'

/** 密钥类字段名（值必须掩码回显）：secret/apiKey/key/appKey/私钥/密码/令牌类 */
export function isSensitivePaymentConfigKey(key: string): boolean {
  if (key === 'key') {
    return true
  }
  return /secret|password|token|private|pem|cert|apikey|api_key|appkey|app_key|signkey|mchkey/i.test(key)
}

/** 把配置 JSON 中的敏感值替换为掩码（非法 JSON 原样返回） */
export function maskPaymentConfigJson(configJson: string): string {
  try {
    const parsed = JSON.parse(configJson) as Record<string, unknown>
    const masked: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(parsed)) {
      masked[key] =
        typeof value === 'string' && value.trim() && isSensitivePaymentConfigKey(key)
          ? PAYMENT_CONFIG_MASK
          : value
    }
    return JSON.stringify(masked)
  } catch {
    return configJson
  }
}

/**
 * 合并提交的配置与存量配置：提交值等于掩码占位的敏感字段还原为存量值。
 * 返回合并后的配置 JSON 字符串。
 */
export function mergeMaskedPaymentConfig(
  submittedConfigJson: string,
  existingConfigJson: string | null | undefined,
): string {
  let submitted: Record<string, unknown>
  try {
    submitted = JSON.parse(submittedConfigJson) as Record<string, unknown>
  } catch {
    return submittedConfigJson
  }

  let existing: Record<string, unknown> = {}
  if (existingConfigJson) {
    try {
      existing = JSON.parse(existingConfigJson) as Record<string, unknown>
    } catch {
      existing = {}
    }
  }

  const merged: Record<string, unknown> = { ...submitted }
  for (const [key, value] of Object.entries(submitted)) {
    if (value === PAYMENT_CONFIG_MASK && isSensitivePaymentConfigKey(key)) {
      const existingValue = existing[key]
      if (typeof existingValue === 'string' && existingValue.trim()) {
        merged[key] = existingValue
      } else {
        // 存量没有可还原的值：删掉掩码占位，让完整性闸门按缺失处理
        delete merged[key]
      }
    }
  }
  return JSON.stringify(merged)
}

/**
 * 配置行响应统一脱敏出口：GET 列表与 POST 保存响应共用，
 * 保证掩码还原后的真实配置永远不出后端（v2.9.0 复查：POST
 * 响应曾原样回显整行，泄露真实密钥）。
 */
export function maskConfigPayload<T extends { configJson: string }>(config: T): T {
  return { ...config, configJson: maskPaymentConfigJson(config.configJson) }
}

/**
 * 卡密日志脱敏：管理端通知/审计/日志里不出现完整卡密
 * （「首绑设备」机制下看到即可抢注）。保留头尾便于核对订单。
 */
export function maskActivationCodeForLog(code: string): string {
  const trimmed = code.trim()
  if (trimmed.length <= 6) {
    return '****'
  }
  return `${trimmed.slice(0, 4)}****${trimmed.slice(-2)}`
}
