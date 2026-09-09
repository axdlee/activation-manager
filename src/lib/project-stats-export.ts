import { createCsvRow } from './csv-utils'

export type ProjectStatsExportTranslate = (key: string, fallback?: string) => string

type ProjectStatsLike = {
  name: string
  projectKey: string
  isEnabled: boolean
  totalCodes: number
  usedCodes: number
  activeCodes: number
  expiredCodes: number
  countRemainingTotal: number
  countConsumedTotal: number
}

export function buildProjectStatsCsv(
  projectStats: ProjectStatsLike[],
  t?: ProjectStatsExportTranslate,
) {
  const header = [
    t?.('stats.csv.project') ?? '项目',
    t?.('stats.csv.projectKey') ?? '项目标识',
    t?.('stats.csv.status') ?? '状态',
    t?.('stats.csv.totalCodes') ?? '总激活码',
    t?.('stats.csv.activated') ?? '已激活',
    t?.('stats.csv.active') ?? '有效',
    t?.('stats.csv.expired') ?? '已过期',
    t?.('stats.csv.remaining') ?? '次数剩余',
    t?.('stats.csv.consumed') ?? '次数消耗',
  ]
  const enabledLabel = t?.('stats.csv.enabled') ?? '启用中'
  const disabledLabel = t?.('stats.csv.disabled') ?? '已停用'

  const rows = [
    createCsvRow(header),
    ...projectStats.map((project) =>
      createCsvRow([
        project.name,
        project.projectKey,
        project.isEnabled ? enabledLabel : disabledLabel,
        project.totalCodes,
        project.usedCodes,
        project.activeCodes,
        project.expiredCodes,
        project.countRemainingTotal,
        project.countConsumedTotal,
      ]),
    ),
  ]

  return `\uFEFF${rows.join('\n')}`
}
