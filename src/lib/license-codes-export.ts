import { getActualExpiresAt, getCodeStatusLabel, getRemainingCount } from './license-status'
import { sanitizeCsvValue } from './csv-utils'
import type { ActivationCode } from './dashboard-page-types'
import type { LicenseModeValue } from './license-status'

export function getProjectDisplayName(code: ActivationCode) {
  return code.project?.name || '默认项目'
}

export function getLicenseModeLabel(mode: LicenseModeValue) {
  return mode === 'COUNT' ? '次数型' : '时间型'
}

export function getSpecLabel(code: ActivationCode) {
  if (code.licenseMode === 'COUNT') {
    return `${code.totalCount || 0} 次`
  }

  if (code.cardType) {
    return code.cardType
  }

  return code.validDays ? `${code.validDays}天` : '无限期'
}

export function getExpiryLabel(code: ActivationCode) {
  if (code.licenseMode === 'COUNT') {
    return '-'
  }

  if (!code.isUsed) {
    return code.validDays ? `${code.validDays}天（激活后生效）` : '无限期'
  }

  const actualExpiresAt = getActualExpiresAt(code)
  return actualExpiresAt ? actualExpiresAt.toLocaleString() : '无限期'
}

/** 与旧 dashboard 导出列完全一致，保证 CSV 契约不变。 */
export function buildCodesCsv(codes: ActivationCode[]) {
  const header =
    '项目,激活码,授权类型,规格,状态,创建时间,过期时间,剩余次数,已用次数,使用时间,绑定设备 / machineId'
  const rows = codes.map((code) => {
    const remaining = code.licenseMode === 'COUNT' ? getRemainingCount(code) ?? 0 : null
    const consumed = code.licenseMode === 'COUNT' ? code.consumedCount ?? 0 : null
    return [
      sanitizeCsvValue(getProjectDisplayName(code)),
      sanitizeCsvValue(code.code),
      sanitizeCsvValue(getLicenseModeLabel(code.licenseMode)),
      sanitizeCsvValue(getSpecLabel(code)),
      sanitizeCsvValue(getCodeStatusLabel(code)),
      sanitizeCsvValue(new Date(code.createdAt).toLocaleString()),
      sanitizeCsvValue(getExpiryLabel(code)),
      sanitizeCsvValue(remaining === null ? '' : String(remaining)),
      sanitizeCsvValue(consumed === null ? '' : String(consumed)),
      sanitizeCsvValue(code.usedAt ? new Date(code.usedAt).toLocaleString() : ''),
      sanitizeCsvValue(code.usedBy || ''),
    ].join(',')
  })

  return [header, ...rows].join('\n')
}

/** 浏览器端下载 CSV（文件名与旧 dashboard 保持一致）。 */
export function exportCodesCsv(codes: ActivationCode[]) {
  const csvContent = `data:text/csv;charset=utf-8,${buildCodesCsv(codes)}`
  const encodedUri = encodeURI(csvContent)
  const link = document.createElement('a')
  link.setAttribute('href', encodedUri)
  link.setAttribute('download', `activation_codes_${new Date().toISOString().split('T')[0]}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
