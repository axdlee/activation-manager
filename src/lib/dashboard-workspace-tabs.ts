import type { SystemConfigGroupKey } from '@/lib/system-config-ui'

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

export type AuditLogWorkspaceTab = 'logs' | 'filters'

export const auditLogWorkspaceTabs: Array<WorkspaceTab<AuditLogWorkspaceTab>> = [
  {
    key: 'logs',
    label: '日志列表',
    shortLabel: '日志',
    description: '查看分页结果并导出管理员操作记录',
  },
  {
    key: 'filters',
    label: '筛选与导出',
    shortLabel: '筛选',
    description: '集中维护项目、操作类型与时间范围条件',
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

export type SystemConfigWorkspaceTab = 'overview' | SystemConfigGroupKey

const systemConfigWorkspaceOverviewTab: WorkspaceTab<SystemConfigWorkspaceTab> = {
  key: 'overview',
  label: '配置总览',
  shortLabel: '总览',
  description: '先看影响提示、分区入口与保存建议',
}

const systemConfigWorkspaceTabMetaMap: Record<
  SystemConfigGroupKey,
  WorkspaceTab<SystemConfigWorkspaceTab>
> = {
  access: {
    key: 'access',
    label: '访问控制',
    shortLabel: '访问',
    description: '集中维护后台访问白名单与来源限制',
  },
  rebind: {
    key: 'rebind',
    label: '换绑策略',
    shortLabel: '换绑',
    description: '维护系统级默认换绑规则，项目级与单码级可继续覆盖',
  },
  security: {
    key: 'security',
    label: '认证与会话',
    shortLabel: '安全',
    description: '统一处理 JWT、会话时长与密码强度',
  },
  branding: {
    key: 'branding',
    label: '系统展示',
    shortLabel: '展示',
    description: '维护管理员侧可见的系统名称与品牌信息',
  },
  advanced: {
    key: 'advanced',
    label: '高级配置',
    shortLabel: '扩展',
    description: '承载暂未归类的扩展配置与演进项',
  },
}

export function buildSystemConfigWorkspaceTabs(
  groups: Array<{ key: SystemConfigGroupKey }>,
): Array<WorkspaceTab<SystemConfigWorkspaceTab>> {
  const groupKeySet = new Set(groups.map((group) => group.key))

  return [
    systemConfigWorkspaceOverviewTab,
    ...(['access', 'rebind', 'security', 'branding', 'advanced'] as const)
      .filter((groupKey) => groupKeySet.has(groupKey))
      .map((groupKey) => systemConfigWorkspaceTabMetaMap[groupKey]),
  ]
}
