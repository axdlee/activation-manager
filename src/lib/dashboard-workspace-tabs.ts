import type { SystemConfigGroupKey } from '@/lib/system-config-ui'

type WorkspaceTab<T extends string> = {
  key: T
  label: string
  shortLabel: string
  description: string
  labelKey?: string
  descriptionKey?: string
}

export type WorkspaceTabTranslate = (key: string, fallback?: string) => string

/** 按可选 t 取标签：未传 t 时返回原中文，保证默认行为不变。 */
export function translateWorkspaceTab<
  T extends {
    label: string
    description: string
    labelKey?: string
    descriptionKey?: string
  },
>(tab: T, t?: WorkspaceTabTranslate): T {
  if (!t) {
    return tab
  }

  return {
    ...tab,
    label: t(tab.labelKey ?? '', tab.label),
    description: t(tab.descriptionKey ?? '', tab.description),
  }
}

export function translateWorkspaceTabs<
  T extends {
    label: string
    description: string
    labelKey?: string
    descriptionKey?: string
  },
>(tabs: T[], t?: WorkspaceTabTranslate): T[] {
  return tabs.map((tab) => translateWorkspaceTab(tab, t))
}

export type ProjectWorkspaceTab = 'manage' | 'create'

export const projectWorkspaceTabs: Array<WorkspaceTab<ProjectWorkspaceTab>> = [
  {
    key: 'manage',
    label: '项目列表',
    shortLabel: '列表',
    description: '筛选、分页并维护已有项目',
    labelKey: 'tabs.project.manage.label',
    descriptionKey: 'tabs.project.manage.desc',
  },
]

export type ActivationCodeWorkspaceTab = 'results' | 'filters'

export const activationCodeWorkspaceTabs: Array<WorkspaceTab<ActivationCodeWorkspaceTab>> = [
  {
    key: 'results',
    label: '结果列表',
    shortLabel: '列表',
    description: '查看分页结果、复制、删除与清理操作',
    labelKey: 'tabs.activation.results.label',
    descriptionKey: 'tabs.activation.results.desc',
  },
  {
    key: 'filters',
    label: '筛选与导出',
    shortLabel: '筛选',
    description: '集中维护关键词、状态、项目与导出条件',
    labelKey: 'tabs.activation.filters.label',
    descriptionKey: 'tabs.activation.filters.desc',
  },
]

export type ConsumptionWorkspaceTab = 'logs' | 'filters'

export const consumptionWorkspaceTabs: Array<WorkspaceTab<ConsumptionWorkspaceTab>> = [
  {
    key: 'logs',
    label: '日志列表',
    shortLabel: '日志',
    description: '聚焦查看分页记录、导出结果与刷新状态',
    labelKey: 'tabs.consumption.logs.label',
    descriptionKey: 'tabs.consumption.logs.desc',
  },
  {
    key: 'filters',
    label: '筛选与刷新',
    shortLabel: '筛选',
    description: '集中设置项目、时间范围与自动刷新条件',
    labelKey: 'tabs.consumption.filters.label',
    descriptionKey: 'tabs.consumption.filters.desc',
  },
]

export type AuditLogWorkspaceTab = 'logs' | 'filters'

export const auditLogWorkspaceTabs: Array<WorkspaceTab<AuditLogWorkspaceTab>> = [
  {
    key: 'logs',
    label: '日志列表',
    shortLabel: '日志',
    description: '查看分页结果并导出管理员操作记录',
    labelKey: 'tabs.audit.logs.label',
    descriptionKey: 'tabs.audit.logs.desc',
  },
  {
    key: 'filters',
    label: '筛选与导出',
    shortLabel: '筛选',
    description: '集中维护项目、操作类型与时间范围条件',
    labelKey: 'tabs.audit.filters.label',
    descriptionKey: 'tabs.audit.filters.desc',
  },
]

export type ApiDocsWorkspaceTab = 'overview' | 'endpoints' | 'examples' | 'admin'

export const apiDocsWorkspaceTabs: Array<WorkspaceTab<ApiDocsWorkspaceTab>> = [
  {
    key: 'overview',
    label: '接入概览',
    shortLabel: '概览',
    description: '先看调研路径、授权模型与字段规范',
    labelKey: 'tabs.apiDocs.overview.label',
    descriptionKey: 'tabs.apiDocs.overview.desc',
  },
  {
    key: 'endpoints',
    label: '正式接口',
    shortLabel: '接口',
    description: '逐个查看 activate / status / consume / verify',
    labelKey: 'tabs.apiDocs.endpoints.label',
    descriptionKey: 'tabs.apiDocs.endpoints.desc',
  },
  {
    key: 'examples',
    label: '多语言示例',
    shortLabel: '示例',
    description: '按 JS/TS、Python、cURL 查看调用方式',
    labelKey: 'tabs.apiDocs.examples.label',
    descriptionKey: 'tabs.apiDocs.examples.desc',
  },
  {
    key: 'admin',
    label: '联调后台',
    shortLabel: '后台',
    description: '结合管理接口、日志和 smoke 脚本完成联调',
    labelKey: 'tabs.apiDocs.admin.label',
    descriptionKey: 'tabs.apiDocs.admin.desc',
  },
]

export type SystemConfigWorkspaceTab = 'overview' | SystemConfigGroupKey

const systemConfigWorkspaceOverviewTab: WorkspaceTab<SystemConfigWorkspaceTab> = {
  key: 'overview',
  label: '配置总览',
  shortLabel: '总览',
  description: '先看影响提示、分区入口与保存建议',
  labelKey: 'tabs.systemConfig.overview.label',
  descriptionKey: 'tabs.systemConfig.overview.desc',
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
    labelKey: 'tabs.systemConfig.access.label',
    descriptionKey: 'tabs.systemConfig.access.desc',
  },
  rebind: {
    key: 'rebind',
    label: '换绑策略',
    shortLabel: '换绑',
    description: '维护系统级默认换绑规则，项目级与单码级可继续覆盖',
    labelKey: 'tabs.systemConfig.rebind.label',
    descriptionKey: 'tabs.systemConfig.rebind.desc',
  },
  security: {
    key: 'security',
    label: '认证与会话',
    shortLabel: '安全',
    description: '统一处理 JWT、会话时长与密码强度',
    labelKey: 'tabs.systemConfig.security.label',
    descriptionKey: 'tabs.systemConfig.security.desc',
  },
  branding: {
    key: 'branding',
    label: '系统展示',
    shortLabel: '展示',
    description: '维护管理员侧可见的系统名称与品牌信息',
    labelKey: 'tabs.systemConfig.branding.label',
    descriptionKey: 'tabs.systemConfig.branding.desc',
  },
  notification: {
    key: 'notification',
    label: '通知与告警',
    shortLabel: '通知',
    description: '配置 Webhook、邮件与短信通知渠道',
    labelKey: 'tabs.systemConfig.notification.label',
    descriptionKey: 'tabs.systemConfig.notification.desc',
  },
  advanced: {
    key: 'advanced',
    label: '高级配置',
    shortLabel: '扩展',
    description: '承载暂未归类的扩展配置与演进项',
    labelKey: 'tabs.systemConfig.advanced.label',
    descriptionKey: 'tabs.systemConfig.advanced.desc',
  },
}

export function buildSystemConfigWorkspaceTabs(
  groups: Array<{ key: SystemConfigGroupKey }>,
  t?: WorkspaceTabTranslate,
): Array<WorkspaceTab<SystemConfigWorkspaceTab>> {
  const groupKeySet = new Set(groups.map((group) => group.key))

  return translateWorkspaceTabs(
    [
      systemConfigWorkspaceOverviewTab,
      ...(['access', 'rebind', 'security', 'branding', 'notification', 'advanced'] as const)
        .filter((groupKey) => groupKeySet.has(groupKey))
        .map((groupKey) => systemConfigWorkspaceTabMetaMap[groupKey]),
    ],
    t,
  )
}
