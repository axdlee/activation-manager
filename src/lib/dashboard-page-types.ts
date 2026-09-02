// Dashboard 页面专用类型定义与常量
// 集中管理页面级的接口/类型/枚举/常量，降低 page.tsx 维护负担。
// 领域通用类型（如 LicenseConsumptionLog）优先定义在对应 lib 模块中。

import type { LicenseModeValue } from './license-status'
import type { DashboardTabKey } from './dashboard-tab-config'

// ── 项目 ──

export interface Project {
  id: number
  name: string
  projectKey: string
  description: string | null
  isEnabled: boolean
  allowAutoRebind: boolean | null
  autoRebindCooldownMinutes: number | null
  autoRebindMaxCount: number | null
  createdAt: string
}

// ── 激活码绑定历史 ──

export interface ActivationCodeBindingHistoryEntry {
  id: number
  eventType: string
  operatorType: string
  operatorUsername: string | null
  fromMachineId: string | null
  toMachineId: string | null
  reason: string | null
  createdAt: string
}

// ── 管理员审计日志 ──

export interface AdminOperationAuditLogEntry {
  id: number
  adminUsername: string
  operationType: string
  targetLabel: string | null
  reason: string | null
  detailJson: string | null
  createdAt: string
  project?: {
    id: number
    name: string
    projectKey: string
  } | null
  activationCode?: {
    id: number
    code: string
  } | null
}

// ── 激活码 ──

export interface ActivationCode {
  id: number
  code: string
  isUsed: boolean
  usedAt: string | null
  usedBy: string | null
  createdAt: string
  updatedAt?: string
  expiresAt: string | null
  validDays: number | null
  cardType: string | null
  projectId: number
  licenseMode: LicenseModeValue
  totalCount: number | null
  remainingCount: number | null
  consumedCount: number
  allowAutoRebind: boolean | null
  autoRebindCooldownMinutes: number | null
  autoRebindMaxCount: number | null
  lastBoundAt: string | null
  lastRebindAt: string | null
  rebindCount: number
  autoRebindCount: number
  bindingHistories?: ActivationCodeBindingHistoryEntry[]
  adminAuditLogs?: AdminOperationAuditLogEntry[]
  project?: {
    id: number
    name: string
    projectKey: string
    allowAutoRebind: boolean | null
    autoRebindCooldownMinutes: number | null
    autoRebindMaxCount: number | null
  }
}

// ── 审计日志过滤条件 ──

export type AuditLogQueryFilters = {
  keyword: string
  projectKey: 'all' | string
  operationType: 'all' | string
  createdFrom: string
  createdTo: string
}

// ── 统计 ──

export interface Stats {
  total: number
  used: number
  expired: number
  active: number
}

export interface ProjectStats {
  id: number
  name: string
  projectKey: string
  isEnabled: boolean
  totalCodes: number
  usedCodes: number
  expiredCodes: number
  activeCodes: number
  countRemainingTotal: number
  countConsumedTotal: number
}

// ── 消费趋势 ──

export interface ConsumptionTrendPoint {
  date: string
  label: string
  count: number
}

export interface ConsumptionTrendComparison {
  previousRangeStart: string
  previousRangeEnd: string
  previousTotalConsumptions: number
  changeCount: number
  changePercentage: number | null
}

export interface ConsumptionTrend {
  days: number
  granularity?: 'day' | 'week' | 'month'
  maxBucketConsumptions?: number
  totalConsumptions: number
  maxDailyConsumptions: number
  comparison: ConsumptionTrendComparison
  points: ConsumptionTrendPoint[]
}

// ── 卡片类型 ──

export interface CardType {
  name: string
  days: number
  description: string
}

// ── 过滤类型 ──

export type TabType = DashboardTabKey
export type StatusFilter = 'all' | 'unused' | 'used' | 'expired' | 'depleted'

// ── 常量 ──

export const statusFilterLabelMap: Record<StatusFilter, string> = {
  all: '全部状态',
  unused: '未激活',
  used: '已使用 / 使用中',
  expired: '已过期',
  depleted: '已耗尽',
}

export const cardTypes: CardType[] = [
  { name: '周卡', days: 7, description: '7天有效期' },
  { name: '月卡', days: 30, description: '30天有效期' },
  { name: '季卡', days: 90, description: '90天有效期' },
  { name: '半年卡', days: 180, description: '180天有效期' },
  { name: '年卡', days: 365, description: '365天有效期' },
  { name: '自定义', days: 0, description: '自定义天数' },
]