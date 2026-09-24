const sensitiveSystemConfigKeys = new Set([
  'jwtSecret',
  'notifyEmailSmtpPass',
  // License API 响应签名密钥（HMAC-SHA256）：泄漏可伪造签名响应
  'licenseResponseSecret',
])

export function isSensitiveSystemConfigKey(key: string) {
  return sensitiveSystemConfigKeys.has(key)
}

/**
 * 敏感且必须配置的键（生产环境缺失时禁止回退默认值）：
 * 仅 jwtSecret；notifyEmailSmtpPass 等敏感键属于可选配置，未配置时使用默认空值。
 */
export function isRequiredSensitiveSystemConfigKey(key: string) {
  return key === 'jwtSecret'
}
