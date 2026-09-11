export type DashboardTabKey =
  | 'generate'
  | 'list'
  | 'stats'
  | 'projects'
  | 'consumptions'
  | 'auditLogs'
  | 'apiDocs'
  | 'shop'
  | 'changePassword'
  | 'systemConfig'

type DashboardTabGroup = 'overview' | 'ops' | 'integration' | 'settings'

type DashboardTabMeta = {
  key: DashboardTabKey
  group: DashboardTabGroup
  label: string
  shortLabel: string
  description: string
  labelKey?: string
  descriptionKey?: string
}

export const dashboardTabs: DashboardTabMeta[] = [
  {
    key: 'stats',
    group: 'overview',
    label: '数据统计',
    shortLabel: '统计',
    description: '集中查看发码规模、项目表现与消费趋势。',
    labelKey: 'tabs.dashboard.stats.label',
    descriptionKey: 'tabs.dashboard.stats.desc',
  },
  {
    key: 'projects',
    group: 'ops',
    label: '项目管理',
    shortLabel: '项目',
    description: '维护项目状态、名称、描述与 projectKey。',
    labelKey: 'tabs.dashboard.projects.label',
    descriptionKey: 'tabs.dashboard.projects.desc',
  },
  {
    key: 'generate',
    group: 'ops',
    label: '生成激活码',
    shortLabel: '发码',
    description: '按项目快速发放时间卡与次数卡。',
    labelKey: 'tabs.dashboard.generate.label',
    descriptionKey: 'tabs.dashboard.generate.desc',
  },
  {
    key: 'list',
    group: 'ops',
    label: '激活码管理',
    shortLabel: '激活码',
    description: '筛选、导出与清理已发放的激活码。',
    labelKey: 'tabs.dashboard.list.label',
    descriptionKey: 'tabs.dashboard.list.desc',
  },
  {
    key: 'consumptions',
    group: 'ops',
    label: '消费日志',
    shortLabel: '日志',
    description: '按 requestId、机器ID与时间范围排查真实扣次记录。',
    labelKey: 'tabs.dashboard.consumptions.label',
    descriptionKey: 'tabs.dashboard.consumptions.desc',
  },
  {
    key: 'auditLogs',
    group: 'ops',
    label: '审计中心',
    shortLabel: '审计',
    description: '集中回溯管理员对项目、激活码与发码动作的关键操作。',
    labelKey: 'tabs.dashboard.auditLogs.label',
    descriptionKey: 'tabs.dashboard.auditLogs.desc',
  },
  {
    key: 'apiDocs',
    group: 'integration',
    label: 'API 接入',
    shortLabel: 'API',
    description: '集中查看正式接口、调研路径与多语言调用示例。',
    labelKey: 'tabs.dashboard.apiDocs.label',
    descriptionKey: 'tabs.dashboard.apiDocs.desc',
  },
  {
    key: 'shop',
    group: 'integration',
    label: '购买中心',
    shortLabel: '商店',
    description: '管理卡密商品、订单与支付渠道，自动发卡。',
    labelKey: 'tabs.dashboard.shop.label',
    descriptionKey: 'tabs.dashboard.shop.desc',
  },
  {
    key: 'changePassword',
    group: 'settings',
    label: '修改密码',
    shortLabel: '密码',
    description: '更新管理员凭据并确保后台访问安全。',
    labelKey: 'tabs.dashboard.changePassword.label',
    descriptionKey: 'tabs.dashboard.changePassword.desc',
  },
  {
    key: 'systemConfig',
    group: 'settings',
    label: '系统配置',
    shortLabel: '配置',
    description: '统一管理白名单、JWT 与系统级参数。',
    labelKey: 'tabs.dashboard.systemConfig.label',
    descriptionKey: 'tabs.dashboard.systemConfig.desc',
  },
]

export type DashboardTabTranslate = (key: string, fallback?: string) => string

export function getDashboardTabMeta(
  tabKey: DashboardTabKey,
  t?: DashboardTabTranslate,
) {
  const meta = dashboardTabs.find((tab) => tab.key === tabKey) || dashboardTabs[0]

  if (!t) {
    return meta
  }

  return {
    ...meta,
    label: t(meta.labelKey ?? '', meta.label),
    shortLabel: meta.shortLabel,
    description: t(meta.descriptionKey ?? '', meta.description),
  }
}
