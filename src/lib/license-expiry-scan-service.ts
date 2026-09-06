import { prisma } from './db'
import { getRemainingCount, isCodeExpired } from './license-status'
import { notifyLicenseExpiry } from './license-expiry-notification-service'

/**
 * 到期通知扫描服务：
 * 主动扫描所有已到期（TIME 过期 / COUNT 耗尽）的激活码并触发通知。
 * 与 status 查询的惰性通知互补——即使客户端从不查询，也能通过
 * 管理 API / 外部 cron 触发主动通知。
 *
 * 去重：notifyLicenseExpiry 内部有进程内去重，重复扫描不会重复通知。
 */

export async function scanExpiredActivationCodes(): Promise<{
  scanned: number
  notified: number
}> {
  const now = new Date()

  const codes = await prisma.activationCode.findMany({
    where: {
      isUsed: true,
    },
    include: { project: true },
  })

  let notified = 0
  let scanned = 0

  for (const code of codes) {
    const isExpired = code.licenseMode !== 'COUNT' && isCodeExpired(code, now)
    const isDepleted =
      code.licenseMode === 'COUNT' && (getRemainingCount(code) ?? 0) <= 0

    if (!isExpired && !isDepleted) {
      continue
    }

    scanned += 1
    if (notifyLicenseExpiry(code)) {
      notified += 1
    }
  }

  return { scanned, notified }
}
