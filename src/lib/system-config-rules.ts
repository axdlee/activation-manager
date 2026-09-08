const sensitiveSystemConfigKeys = new Set(['jwtSecret', 'notifyEmailSmtpPass'])

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
