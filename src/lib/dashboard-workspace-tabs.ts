type WorkspaceTab<T extends string> = {
  key: T
  label: string
  shortLabel: string
  description: string
}

export type ProjectWorkspaceTab = 'manage' | 'create'

export const projectWorkspaceTabs: Array<WorkspaceTab<ProjectWorkspaceTab>> = [
  {
    key: 'manage',
    label: '项目列表',
    shortLabel: '列表',
    description: '筛选、分页并维护已有项目',
  },
  {
    key: 'create',
    label: '新建项目',
    shortLabel: '新建',
    description: '创建新的项目名称、标识与描述',
  },
]

export type ActivationCodeWorkspaceTab = 'results' | 'filters'

export const activationCodeWorkspaceTabs: Array<WorkspaceTab<ActivationCodeWorkspaceTab>> = [
  {
    key: 'results',
    label: '结果列表',
    shortLabel: '列表',
    description: '查看分页结果、复制、删除与清理操作',
  },
  {
    key: 'filters',
    label: '筛选与导出',
    shortLabel: '筛选',
    description: '集中维护关键词、状态、项目与导出条件',
  },
]

export type ConsumptionWorkspaceTab = 'logs' | 'filters'

export const consumptionWorkspaceTabs: Array<WorkspaceTab<ConsumptionWorkspaceTab>> = [
  {
    key: 'logs',
    label: '日志列表',
    shortLabel: '日志',
    description: '聚焦查看分页记录、导出结果与刷新状态',
  },
  {
    key: 'filters',
    label: '筛选与刷新',
    shortLabel: '筛选',
    description: '集中设置项目、时间范围与自动刷新条件',
  },
]

export type ApiDocsWorkspaceTab = 'overview' | 'endpoints' | 'examples' | 'admin'

export const apiDocsWorkspaceTabs: Array<WorkspaceTab<ApiDocsWorkspaceTab>> = [
  {
    key: 'overview',
    label: '接入概览',
    shortLabel: '概览',
    description: '先看调研路径、授权模型与字段规范',
  },
  {
    key: 'endpoints',
    label: '正式接口',
    shortLabel: '接口',
    description: '逐个查看 activate / status / consume / verify',
  },
  {
    key: 'examples',
    label: '多语言示例',
    shortLabel: '示例',
    description: '按 JS/TS、Python、cURL 查看调用方式',
  },
  {
    key: 'admin',
    label: '联调后台',
    shortLabel: '后台',
    description: '结合管理接口、日志和 smoke 脚本完成联调',
  },
]
