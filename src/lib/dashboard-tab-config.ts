export type DashboardTabKey =
  | 'generate'
  | 'list'
  | 'stats'
  | 'projects'
  | 'consumptions'
  | 'auditLogs'
  | 'apiDocs'
  | 'changePassword'
  | 'systemConfig'

type DashboardTabMeta = {
  key: DashboardTabKey
  label: string
  shortLabel: string
  description: string
}

export const dashboardTabs: DashboardTabMeta[] = [
  {
    key: 'stats',
    label: '数据统计',
    shortLabel: '统计',
    description: '集中查看发码规模、项目表现与消费趋势。',
  },
  {
    key: 'projects',
    label: '项目管理',
    shortLabel: '项目',
    description: '维护项目状态、名称、描述与 projectKey。',
  },
  {
    key: 'generate',
    label: '生成激活码',
    shortLabel: '发码',
    description: '按项目快速发放时间卡与次数卡。',
  },
  {
    key: 'list',
    label: '激活码管理',
    shortLabel: '激活码',
    description: '筛选、导出与清理已发放的激活码。',
  },
  {
    key: 'consumptions',
    label: '消费日志',
    shortLabel: '日志',
    description: '按 requestId、机器ID与时间范围排查真实扣次记录。',
  },
  {
    key: 'auditLogs',
    label: '审计中心',
    shortLabel: '审计',
    description: '集中回溯管理员对项目、激活码与发码动作的关键操作。',
  },
  {
    key: 'apiDocs',
    label: 'API 接入',
    shortLabel: 'API',
    description: '集中查看正式接口、调研路径与多语言调用示例。',
  },
  {
    key: 'changePassword',
    label: '修改密码',
    shortLabel: '密码',
    description: '更新管理员凭据并确保后台访问安全。',
  },
  {
    key: 'systemConfig',
    label: '系统配置',
    shortLabel: '配置',
    description: '统一管理白名单、JWT 与系统级参数。',
  },
]

export function getDashboardTabMeta(tabKey: DashboardTabKey) {
  return dashboardTabs.find((tab) => tab.key === tabKey) || dashboardTabs[0]
}
