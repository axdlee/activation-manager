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

function escapeCsvValue(value: string | number) {
  const normalizedValue = String(value)

  if (/[",\n]/.test(normalizedValue)) {
    return `"${normalizedValue.replace(/"/g, '""')}"`
  }

  return normalizedValue
}

function createCsvRow(values: Array<string | number>) {
  return values.map(escapeCsvValue).join(',')
}

export function buildProjectStatsCsv(projectStats: ProjectStatsLike[]) {
  const rows = [
    createCsvRow(['项目', '项目标识', '状态', '总激活码', '已激活', '有效', '已过期', '次数剩余', '次数消耗']),
    ...projectStats.map((project) =>
      createCsvRow([
        project.name,
        project.projectKey,
        project.isEnabled ? '启用中' : '已停用',
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
