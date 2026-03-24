export type LicenseModeValue = 'TIME' | 'COUNT'

export type LicenseStatusLike = {
  isUsed: boolean
  usedAt: Date | string | null
  expiresAt: Date | string | null
  validDays: number | null
  licenseMode?: LicenseModeValue | string | null
  totalCount?: number | null
  remainingCount?: number | null
}

function toDate(value: Date | string | null | undefined) {
  if (!value) {
    return null
  }

  return value instanceof Date ? value : new Date(value)
}

export function getRemainingCount(code: LicenseStatusLike) {
  if (code.licenseMode !== 'COUNT') {
    return null
  }

  if (typeof code.remainingCount === 'number') {
    return code.remainingCount
  }

  if (typeof code.totalCount === 'number') {
    return code.totalCount
  }

  return 0
}

export function getActualExpiresAt(code: LicenseStatusLike) {
  if (code.licenseMode === 'COUNT') {
    return null
  }

  const usedAt = toDate(code.usedAt)
  if (usedAt && code.validDays) {
    return new Date(usedAt.getTime() + code.validDays * 24 * 60 * 60 * 1000)
  }

  return toDate(code.expiresAt)
}

export function isCodeExpired(code: LicenseStatusLike, now: Date = new Date()) {
  if (code.licenseMode === 'COUNT') {
    return false
  }

  const expiresAt = getActualExpiresAt(code)
  return Boolean(expiresAt && expiresAt < now)
}

export function isCountCodeDepleted(code: LicenseStatusLike) {
  if (code.licenseMode !== 'COUNT') {
    return false
  }

  return getRemainingCount(code) !== null && getRemainingCount(code)! <= 0
}

export function isCodeActive(code: LicenseStatusLike, now: Date = new Date()) {
  if (code.licenseMode === 'COUNT') {
    return !isCountCodeDepleted(code)
  }

  if (!code.isUsed) {
    return true
  }

  return !isCodeExpired(code, now)
}

export function getCodeStatusLabel(code: LicenseStatusLike, now: Date = new Date()) {
  if (code.licenseMode === 'COUNT') {
    if (!code.isUsed) {
      return '未激活'
    }

    return isCountCodeDepleted(code) ? '已耗尽' : '使用中'
  }

  if (isCodeExpired(code, now)) {
    return '已过期'
  }

  return code.isUsed ? '已使用' : '未激活'
}
