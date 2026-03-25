import {
  getActualExpiresAt,
  getRemainingCount,
  isCodeExpired,
  type LicenseStatusLike,
} from './license-status'

export type LicenseResult = {
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

type LicenseResultCode = LicenseStatusLike & {
  licenseMode: string
}

type CountConsumeSuccessOptions = {
  remainingCount?: number | null
  message?: string
  idempotent?: boolean
  includeExpiresAt?: boolean
}

function buildActivationState(code: LicenseResultCode) {
  return {
    licenseMode: code.licenseMode,
    expiresAt: getActualExpiresAt(code),
    remainingCount: getRemainingCount(code),
    isActivated: code.isUsed,
  }
}

export function createMissingParamsResult(): LicenseResult {
  return {
    success: false,
    message: '激活码和机器ID不能为空',
    status: 400,
  }
}

export function createLicenseNotFoundResult(): LicenseResult {
  return {
    success: false,
    message: '激活码不存在',
    status: 404,
  }
}

export function createUsedByOtherDeviceResult(): LicenseResult {
  return {
    success: false,
    message: '激活码已被其他设备使用',
    status: 400,
  }
}

export function createExpiredResult(): LicenseResult {
  return {
    success: false,
    message: '激活码已过期',
    status: 400,
  }
}

export function createCountExhaustedResult(): LicenseResult {
  return {
    success: false,
    message: '激活码可用次数已用完',
    status: 400,
  }
}

export function createStateChangedRetryResult(): LicenseResult {
  return {
    success: false,
    message: '激活码状态已变化，请重试',
    status: 409,
  }
}

export function createPendingConsumptionRequestResult(): LicenseResult {
  return {
    success: false,
    message: 'requestId 正在处理中，请稍后重试',
    status: 409,
  }
}

export function createRequestIdConflictResult(): LicenseResult {
  return {
    success: false,
    message: 'requestId 已被其他请求使用',
    status: 409,
  }
}

export function createActivationSuccessResult(
  code: LicenseResultCode,
  message: string,
): LicenseResult {
  return {
    success: true,
    message,
    status: 200,
    ...buildActivationState(code),
    valid:
      code.licenseMode === 'COUNT'
        ? (getRemainingCount(code) ?? 0) > 0
        : !isCodeExpired(code),
  }
}

export function createLicenseStatusSuccessResult(
  code: LicenseResultCode,
): LicenseResult {
  return {
    success: true,
    message: '获取激活码状态成功',
    status: 200,
    ...buildActivationState(code),
    valid:
      code.licenseMode === 'COUNT'
        ? (getRemainingCount(code) ?? 0) > 0
        : !code.isUsed || !isCodeExpired(code),
  }
}

export function createTimeConsumeSuccessResult(
  code: LicenseResultCode,
): LicenseResult {
  return {
    success: true,
    message: '激活码验证成功',
    status: 200,
    licenseMode: code.licenseMode,
    expiresAt: getActualExpiresAt(code),
    isActivated: code.isUsed,
    valid: true,
  }
}

export function createCountConsumeSuccessResult(
  code: LicenseResultCode,
  options: CountConsumeSuccessOptions = {},
): LicenseResult {
  const remainingCount = options.remainingCount ?? getRemainingCount(code)
  const result: LicenseResult = {
    success: true,
    message: options.message ?? '激活码验证成功',
    status: 200,
    licenseMode: code.licenseMode,
    remainingCount,
    isActivated: code.isUsed,
    valid: (remainingCount ?? 0) > 0,
    idempotent: options.idempotent ?? false,
  }

  if (options.includeExpiresAt) {
    result.expiresAt = getActualExpiresAt(code)
  }

  return result
}
