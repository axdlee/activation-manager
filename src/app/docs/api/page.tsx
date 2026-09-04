import React from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { ApiDocsWorkspace } from '@/components/api-docs-workspace'
import {
  publicContainerClassName,
} from '@/lib/public-ui'

export const metadata: Metadata = {
  title: 'API 接入文档',
  description:
    '激活码服务的公开 API 接入文档，集中展示正式接口、授权模型、多语言示例与后台联调方式。',
}

const docsHighlights = [
  {
    label: '正式流程',
    value: '3 步',
    description: 'activate → status → consume，适合新插件与新客户端。',
  },
  {
    label: '授权模型',
    value: 'TIME / COUNT',
    description: '同一套服务同时支持时间型和次数型授权。',
  },
  {
    label: '联调资源',
    value: 'SDK + Smoke',
    description: '内含多语言示例、管理接口与本地联调脚本入口。',
  },
]

const apiDocsPageClassName = 'min-h-screen bg-surface-50 px-4 py-6 text-ink-50 sm:px-6 lg:px-8'

const apiDocsShellClassName =
  'rounded-lg border border-brand-500/20 bg-surface-100 shadow-card'

const apiDocsPillClassName =
  'inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-500/100/10 px-3 py-1 text-[11px] font-semibold tracking-[0.22em] text-brand-400 shadow-sm'

const apiDocsPrimaryButtonClassName =
  'inline-flex items-center justify-center rounded-md bg-gradient-to-r from-brand-500 via-brand-600 to-brand-700 px-5 py-3 text-sm font-semibold text-white shadow-glow transition-all hover:from-brand-400 hover:via-brand-500 hover:to-brand-600 disabled:cursor-not-allowed disabled:opacity-50'

const apiDocsSecondaryButtonClassName =
  'inline-flex items-center justify-center rounded-md border border-surface-200 bg-surface-100 px-5 py-3 text-sm font-semibold text-ink-200 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-500/20 hover:bg-brand-500/100/10'

const apiDocsHighlightCardClassName =
  'rounded-lg border border-surface-200 bg-surface-100 px-5 py-5 shadow-card'

export default function ApiDocsPage() {
  return (
    <main className={apiDocsPageClassName}>
      <div className={publicContainerClassName}>
        <section className={`${apiDocsShellClassName} relative overflow-hidden p-6 sm:p-8`}>
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(circle at top right, rgba(14,165,233,0.14), transparent 28%), radial-gradient(circle at bottom left, rgba(99,102,241,0.12), transparent 30%)',
            }}
          />
          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className={apiDocsPillClassName}>
                <span className="h-2 w-2 rounded-full bg-brand-500/100/100" />
                对外接入说明
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink-50 sm:text-4xl">
                面向插件与客户端的 API 文档中心
              </h1>
              <p className="mt-3 text-sm leading-7 text-ink-500 sm:text-base">
                该页面可直接发给插件开发者、桌面端、测试同学与合作方，无需进入后台即可查看完整接入路径与示例代码。
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/admin/login" className={apiDocsPrimaryButtonClassName}>
                  管理员登录
                </Link>
                <Link href="/" className={apiDocsSecondaryButtonClassName}>
                  返回首页
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 xl:max-w-3xl">
              {docsHighlights.map((item) => (
                <div key={item.label} className={apiDocsHighlightCardClassName}>
                  <div className="text-xs uppercase tracking-[0.18em] text-ink-500">
                    {item.label}
                  </div>
                  <div className="mt-3 text-2xl font-semibold tracking-tight text-ink-50">
                    {item.value}
                  </div>
                  <div className="mt-2 text-sm leading-6 text-ink-500">
                    {item.description}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <ApiDocsWorkspace mode="public" />
      </div>
    </main>
  )
}
