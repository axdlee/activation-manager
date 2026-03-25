import React from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { ApiDocsWorkspace } from '@/components/api-docs-workspace'
import {
  publicContainerClassName,
  publicPageClassName,
  publicPillClassName,
  publicPrimaryButtonClassName,
  publicSecondaryButtonClassName,
  publicShellClassName,
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

export default function ApiDocsPage() {
  return (
    <main className={publicPageClassName}>
      <div className={publicContainerClassName}>
        <section className={`${publicShellClassName} relative overflow-hidden p-6 sm:p-8`}>
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(circle at top right, rgba(14,165,233,0.14), transparent 28%), radial-gradient(circle at bottom left, rgba(99,102,241,0.12), transparent 30%)',
            }}
          />
          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className={publicPillClassName}>
                <span className="h-2 w-2 rounded-full bg-sky-500" />
                对外接入说明
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                面向插件与客户端的 API 文档中心
              </h1>
              <p className="mt-3 text-sm leading-7 text-slate-500 sm:text-base">
                该页面可直接发给插件开发者、桌面端、测试同学与合作方，无需进入后台即可查看完整接入路径与示例代码。
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/admin/login" className={publicPrimaryButtonClassName}>
                  管理员登录
                </Link>
                <Link href="/" className={publicSecondaryButtonClassName}>
                  返回首页
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 xl:max-w-3xl">
              {docsHighlights.map((item) => (
                <div
                  key={item.label}
                  className="rounded-[24px] border border-slate-200 bg-white px-5 py-5 shadow-[0_18px_56px_-42px_rgba(15,23,42,0.16)]"
                >
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    {item.label}
                  </div>
                  <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
                    {item.value}
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-500">
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
