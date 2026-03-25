'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'

import { ApiDocsAdminGroupCard } from '@/components/api-docs-admin-group-card'
import { ApiDocsDebugCommandCard } from '@/components/api-docs-debug-command-card'
import { DashboardCodePanel } from '@/components/dashboard-code-panel'
import { DashboardSummaryCard } from '@/components/dashboard-summary-card'
import { buildApiDocsPageModel } from '@/lib/api-docs-ui'
import {
  apiDocsWorkspaceTabs,
  type ApiDocsWorkspaceTab,
} from '@/lib/dashboard-workspace-tabs'
import {
  publicFeatureCardClassName,
  publicPanelClassName,
  publicPillClassName,
  publicPrimaryButtonClassName,
  publicSecondaryButtonClassName,
} from '@/lib/public-ui'

type ApiDocsWorkspaceProps = {
  mode?: 'dashboard' | 'public'
  initialTab?: ApiDocsWorkspaceTab
  onFeedback?: (content: string, type?: 'success' | 'error') => void
}

const summaryCardThemeMap = {
  sky: {
    panel:
      'border-sky-200/80 bg-[linear-gradient(180deg,rgba(240,249,255,0.96),rgba(255,255,255,0.94))]',
    accent: 'bg-sky-500',
    value: 'text-sky-900',
  },
  emerald: {
    panel:
      'border-emerald-200/80 bg-[linear-gradient(180deg,rgba(236,253,245,0.96),rgba(255,255,255,0.94))]',
    accent: 'bg-emerald-500',
    value: 'text-emerald-900',
  },
  violet: {
    panel:
      'border-violet-200/80 bg-[linear-gradient(180deg,rgba(245,243,255,0.96),rgba(255,255,255,0.94))]',
    accent: 'bg-violet-500',
    value: 'text-violet-900',
  },
} as const

const audienceBadgeClassNameMap = {
  recommended: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  compat: 'border-violet-200 bg-violet-50 text-violet-700',
} as const

const methodBadgeClassNameMap = {
  GET: 'border-sky-200 bg-sky-50 text-sky-700',
  POST: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  PATCH: 'border-amber-200 bg-amber-50 text-amber-700',
  DELETE: 'border-rose-200 bg-rose-50 text-rose-700',
} as const

const tableContainerClassName =
  'overflow-x-auto rounded-[24px] border border-slate-200 bg-white shadow-[0_18px_56px_-42px_rgba(15,23,42,0.16)]'

const inlineActionButtonClassName =
  'inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'

const publicCodeBlockClassName =
  'overflow-x-auto rounded-[22px] border border-sky-100 bg-slate-50 px-4 py-4 font-mono text-[12px] leading-6 text-slate-800 shadow-inner shadow-sky-100/50'

export function ApiDocsWorkspace({
  mode = 'dashboard',
  initialTab = 'overview',
  onFeedback,
}: ApiDocsWorkspaceProps) {
  const isPublicMode = mode === 'public'
  const [activeTab, setActiveTab] = useState<ApiDocsWorkspaceTab>(initialTab)
  const [localFeedback, setLocalFeedback] = useState<{
    text: string
    type: 'success' | 'error'
  } | null>(null)
  const feedbackTimerRef = useRef<number | null>(null)
  const apiDocsPageModel = useMemo(() => buildApiDocsPageModel(), [])

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) {
        window.clearTimeout(feedbackTimerRef.current)
      }
    }
  }, [])

  const notify = (content: string, type: 'success' | 'error' = 'success') => {
    if (onFeedback) {
      onFeedback(content, type)
      return
    }

    setLocalFeedback({ text: content, type })
    if (feedbackTimerRef.current) {
      window.clearTimeout(feedbackTimerRef.current)
    }
    feedbackTimerRef.current = window.setTimeout(() => {
      setLocalFeedback(null)
    }, 2400)
  }

  const copyToClipboard = async (
    text: string,
    successMessage = '已复制到剪贴板',
  ) => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('clipboard not supported')
      }

      await navigator.clipboard.writeText(text)
      notify(successMessage)
    } catch (error) {
      notify('当前环境不支持自动复制，请手动复制', 'error')
    }
  }

  const heroContent =
    mode === 'public'
      ? {
          badge: '公开 API 文档',
          title: '激活码服务接入工作区',
          description:
            '面向插件开发者、客户端、测试同学与合作方统一展示正式接口、授权模型、多语言示例与联调路径。',
          asideTitle: '无需登录即可查阅',
          asideDescription:
            '推荐先看概览，再按 activate → status → consume 的正式流程完成接入；旧插件仅在兼容场景下继续使用 /api/verify。',
        }
      : {
          badge: 'API 接入工作区',
          title: '插件与客户端接入指南',
          description:
            '把“如何调研 API、如何正式接入、如何用后台核对结果”统一整理成一个可操作页面，减少口口相传和重复答疑。',
          asideTitle: '推荐正式流程',
          asideDescription:
            'activate → status → consume；旧插件仅在兼容场景下继续使用 /api/verify。',
        }

  return (
    <div className="space-y-6">
      <div className={`${publicPanelClassName} relative overflow-hidden p-6 sm:p-7`}>
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at top left, rgba(14,165,233,0.12), transparent 28%), radial-gradient(circle at bottom right, rgba(139,92,246,0.08), transparent 30%)',
          }}
        />
        <div className="relative">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className={publicPillClassName}>
                <span className="h-2 w-2 rounded-full bg-sky-500" />
                {heroContent.badge}
              </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
                {heroContent.title}
              </h2>
              <p className="mt-2 text-sm leading-7 text-slate-500 sm:text-base">
                {heroContent.description}
              </p>
            </div>

            <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-4 text-sm leading-6 text-slate-600 shadow-[0_18px_56px_-42px_rgba(15,23,42,0.16)]">
              <div className="font-semibold text-slate-900">{heroContent.asideTitle}</div>
              <div className="mt-1 text-slate-500">{heroContent.asideDescription}</div>
            </div>
          </div>

          {!onFeedback && localFeedback && (
            <div
              className={`mt-5 rounded-[20px] border px-4 py-3 text-sm ${
                localFeedback.type === 'error'
                  ? 'border-rose-200 bg-rose-50 text-rose-700'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700'
              }`}
            >
              {localFeedback.text}
            </div>
          )}

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {apiDocsPageModel.summaryCards.map((card) => {
              const summaryCardTheme = summaryCardThemeMap[card.tone]

              return (
                <DashboardSummaryCard
                  key={card.label}
                  label={card.label}
                  value={card.value}
                  description={card.description}
                  panelClassName={summaryCardTheme.panel}
                  accentClassName={summaryCardTheme.accent}
                  valueClassName={`mt-3 text-3xl font-semibold tracking-tight ${summaryCardTheme.value}`}
                />
              )
            })}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {apiDocsWorkspaceTabs.map((tab) => {
              const isActive = activeTab === tab.key

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`rounded-[24px] border p-4 text-left transition ${
                    isActive
                      ? 'border-sky-200 bg-sky-50/85 shadow-[0_20px_60px_-40px_rgba(2,132,199,0.35)]'
                      : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-sky-100 hover:bg-sky-50/60'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xs font-semibold ${
                        isActive
                          ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20'
                          : isPublicMode
                            ? 'bg-sky-50 text-sky-700 ring-1 ring-sky-100'
                            : 'bg-slate-900 text-white/90'
                      }`}
                    >
                      {tab.shortLabel}
                    </div>
                    <div className="min-w-0">
                      <div
                        className={`text-sm font-semibold ${
                          isActive ? 'text-sky-900' : 'text-slate-900'
                        }`}
                      >
                        {tab.label}
                      </div>
                      <div
                        className={`mt-1 text-xs leading-6 ${
                          isActive ? 'text-sky-700' : 'text-slate-500'
                        }`}
                      >
                        {tab.description}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className={`${publicPanelClassName} p-6`}>
            <div className="mb-5">
              <h3 className="text-xl font-semibold text-slate-900">推荐调研路径</h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                建议把接口调研理解为一个业务闭环：先准备 projectKey，再绑定、查询、扣次，最后用后台日志和
                smoke 脚本回证。
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {apiDocsPageModel.researchSteps.map((step) => (
                <div key={step.step} className={publicFeatureCardClassName}>
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white shadow-sm">
                      {step.step}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-base font-semibold text-slate-900">
                        {step.title}
                      </h4>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        {step.description}
                      </p>
                      <div className="mt-3 rounded-[18px] border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-700">
                        <span className="font-medium text-sky-900">你会得到：</span>{' '}
                        {step.outcome}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            {apiDocsPageModel.licenseModels.map((card) => (
              <div key={card.badge} className={`${publicPanelClassName} p-6`}>
                <div className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-sky-700">
                  {card.badge}
                </div>
                <h3 className="mt-4 text-xl font-semibold text-slate-900">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{card.description}</p>
                <div className="mt-4 space-y-3">
                  {card.bullets.map((bullet) => (
                    <div
                      key={bullet}
                      className="flex items-start gap-3 rounded-[20px] border border-slate-200/80 bg-slate-50/85 px-4 py-4 text-sm leading-6 text-slate-600"
                    >
                      <span className="mt-1 h-2.5 w-2.5 rounded-full bg-sky-500" />
                      <span>{bullet}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className={`${publicPanelClassName} p-6`}>
              <div className="mb-5">
                <h3 className="text-xl font-semibold text-slate-900">通用请求字段</h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  正式接口支持 camelCase / snake_case 双写法，便于不同语言和历史客户端接入。
                </p>
              </div>
              <div className={tableContainerClassName}>
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50/90">
                    <tr>
                      {['字段', '类型', '必填', '说明'].map((title) => (
                        <th
                          key={title}
                          className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500"
                        >
                          {title}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {apiDocsPageModel.requestFields.map((field) => (
                      <tr key={field.field} className="transition hover:bg-slate-50/80">
                        <td className="px-6 py-4 text-sm font-mono text-slate-900">
                          {field.field}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">{field.type}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">
                          {field.required}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">
                          {field.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={`${publicPanelClassName} p-6`}>
              <div className="mb-5">
                <h3 className="text-xl font-semibold text-slate-900">统一响应字段</h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  正式接口会同时返回 camelCase 与 snake_case，便于浏览器插件、桌面端和脚本工具统一接入。
                </p>
              </div>
              <div className={tableContainerClassName}>
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50/90">
                    <tr>
                      {['字段', '类型', '返回时机', '说明'].map((title) => (
                        <th
                          key={title}
                          className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500"
                        >
                          {title}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {apiDocsPageModel.responseFields.map((field) => (
                      <tr key={field.field} className="transition hover:bg-slate-50/80">
                        <td className="px-6 py-4 text-sm font-mono text-slate-900">
                          {field.field}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">{field.type}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">
                          {field.required}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">
                          {field.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'endpoints' && (
        <div className="space-y-6">
          {apiDocsPageModel.endpoints.map((endpoint) => (
            <div key={endpoint.key} className={`${publicPanelClassName} p-6`}>
              <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${methodBadgeClassNameMap[endpoint.method]}`}
                    >
                      {endpoint.method}
                    </span>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${audienceBadgeClassNameMap[endpoint.audience]}`}
                    >
                      {endpoint.audience === 'recommended'
                        ? '推荐正式接口'
                        : '兼容旧接口'}
                    </span>
                  </div>
                  <h3 className="mt-4 text-xl font-semibold text-slate-900">
                    {endpoint.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {endpoint.summary}
                  </p>
                  <div className="mt-3 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                    <span className="font-medium text-slate-900">适用时机：</span>{' '}
                    {endpoint.whenToUse}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-sm font-mono text-slate-700 shadow-sm">
                    {endpoint.path}
                  </div>
                  <button
                    type="button"
                    onClick={() => void copyToClipboard(endpoint.path, '接口路径已复制')}
                    className={publicSecondaryButtonClassName}
                  >
                    复制路径
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.86fr_1.14fr]">
                <div className="space-y-3">
                  {endpoint.highlights.map((highlight) => (
                    <div
                      key={highlight}
                      className="flex items-start gap-3 rounded-[20px] border border-slate-200/80 bg-slate-50/85 px-4 py-4 text-sm leading-6 text-slate-600"
                    >
                      <span className="mt-1 h-2.5 w-2.5 rounded-full bg-sky-500" />
                      <span>{highlight}</span>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-5">
                  <DashboardCodePanel
                    header={
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                          请求示例
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                          可直接用于 Postman、脚本或插件侧联调。
                        </div>
                      </div>
                    }
                    action={
                      <button
                        type="button"
                        onClick={() =>
                          void copyToClipboard(endpoint.requestExample, '请求示例已复制')
                        }
                        className={inlineActionButtonClassName}
                      >
                        复制
                      </button>
                    }
                    code={endpoint.requestExample}
                    codeClassName={isPublicMode ? publicCodeBlockClassName : undefined}
                  />

                  <DashboardCodePanel
                    header={
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                          响应示例
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                          用于核对业务是否成功、字段是否匹配以及是否命中幂等。
                        </div>
                      </div>
                    }
                    action={
                      <button
                        type="button"
                        onClick={() =>
                          void copyToClipboard(endpoint.responseExample, '响应示例已复制')
                        }
                        className={inlineActionButtonClassName}
                      >
                        复制
                      </button>
                    }
                    code={endpoint.responseExample}
                    codeClassName={isPublicMode ? publicCodeBlockClassName : undefined}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'examples' && (
        <div className="grid grid-cols-1 gap-6">
          {apiDocsPageModel.languageSnippets.map((snippet) => (
            <DashboardCodePanel
              key={snippet.key}
              panelClassName={`${publicPanelClassName} p-6`}
              headerClassName="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"
              header={
                <div className="max-w-3xl">
                  <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-slate-600">
                    {snippet.label}
                  </div>
                  <h3 className="mt-4 text-xl font-semibold text-slate-900">
                    {snippet.label}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {snippet.description}
                  </p>
                </div>
              }
              action={
                <button
                  type="button"
                  onClick={() =>
                    void copyToClipboard(snippet.code, `${snippet.label} 示例已复制`)
                  }
                  className={publicPrimaryButtonClassName}
                >
                  复制示例代码
                </button>
              }
              code={snippet.code}
              codeClassName={isPublicMode ? publicCodeBlockClassName : undefined}
            />
          ))}
        </div>
      )}

      {activeTab === 'admin' && (
        <div className="space-y-6">
          <div className={`${publicPanelClassName} p-6`}>
            <div className="mb-5">
              <h3 className="text-xl font-semibold text-slate-900">
                联调时常用的后台接口
              </h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                当你需要生成测试码、核对 requestId、导出日志或确认项目是否启用时，可直接参考这些管理接口。
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              {apiDocsPageModel.adminGroups.map((group) => (
                <ApiDocsAdminGroupCard
                  key={group.title}
                  title={group.title}
                  description={group.description}
                  endpoints={group.endpoints}
                  methodBadgeClassNameMap={methodBadgeClassNameMap}
                />
              ))}
            </div>
          </div>

          <div className={`${publicPanelClassName} p-6`}>
            <div className="mb-5">
              <h3 className="text-xl font-semibold text-slate-900">
                本地联调与排查辅助
              </h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                除了接口本身，建议同时把 smoke 脚本、SDK 源码和完整文档路径暴露给接入者，降低沟通成本。
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              {apiDocsPageModel.localDebugging.map((item) => (
                <ApiDocsDebugCommandCard
                  key={item.title}
                  title={item.title}
                  description={item.description}
                  command={item.command}
                  onCopy={() => void copyToClipboard(item.command, `${item.title} 已复制`)}
                  buttonClassName={publicSecondaryButtonClassName}
                  codeClassName={isPublicMode ? publicCodeBlockClassName : undefined}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
