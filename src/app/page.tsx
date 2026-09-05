import React from 'react'
import Link from 'next/link'

import {
  publicContainerClassName,
  publicFeatureCardClassName,
  publicPageClassName,
  publicPillClassName,
  publicPrimaryButtonClassName,
  publicSecondaryButtonClassName,
  publicShellClassName,
  publicStatCardClassName,
} from '@/lib/public-ui'

const capabilityCards = [
  {
    title: '多项目隔离',
    description: '独立 projectKey、启停状态与发码空间，同时服务多个插件或客户。',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={1.8}>
        <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: '时间卡 + 次数卡',
    description: 'TIME / COUNT 双授权模型，兼顾订阅制与按次扣费两类业务。',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={1.8}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'API 接入文档',
    description: '调研路径、字段说明、多语言示例与联调入口，减少重复沟通。',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={1.8}>
        <path d="M8 8l-4 4 4 4M16 8l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
]

const operationCards = [
  { label: '项目工作台', value: 'Project', description: '管理标识、描述、启停与接入范围' },
  { label: '授权模型', value: 'TIME / COUNT', description: '支持时间与次数两种发码策略' },
  { label: '对接闭环', value: 'Docs + Logs', description: '从调研、接入到日志排查完整链路' },
]

export default function Home() {
  return (
    <main className={publicPageClassName}>
      <div className={publicContainerClassName}>
        {/* ===== Hero ===== */}
        <section className={`${publicShellClassName} animate-fade-in-up overflow-hidden`}>
          <div className="flex flex-col gap-10 p-8 lg:flex-row lg:items-start lg:p-12">
            <div className="max-w-2xl flex-1">
              <div className={publicPillClassName}>
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                License Ops Center
              </div>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-ink-50 sm:text-5xl">
                激活码管理系统
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-ink-500">
                面向多项目、多授权模型与插件接入场景的一体化后台。发码、查码、看消费趋势，并把公开
                API 文档直接交给接入方。
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/admin/login" className={publicPrimaryButtonClassName}>
                  进入管理后台
                </Link>
                <Link href="/docs/api" className={publicSecondaryButtonClassName}>
                  查看 API 文档
                </Link>
              </div>

              <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
                {operationCards.map((item) => (
                  <div key={item.label} className={publicStatCardClassName}>
                    <div className="text-xs font-medium uppercase tracking-wider text-ink-500">
                      {item.label}
                    </div>
                    <div className="mt-2.5 text-xl font-semibold tracking-tight text-ink-50">
                      {item.value}
                    </div>
                    <div className="mt-1.5 text-sm leading-6 text-ink-500">{item.description}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="w-full shrink-0 space-y-4 lg:w-80">
              {capabilityCards.map((card) => (
                <div key={card.title} className={publicFeatureCardClassName}>
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-md border border-brand-500/20 bg-brand-500/10 text-brand-400">
                      {card.icon}
                    </span>
                    <span className="text-base font-semibold text-ink-50">{card.title}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-ink-500">{card.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== 使用场景与快速入口 ===== */}
        <section className="grid gap-6 lg:grid-cols-2">
          <div className={`${publicShellClassName} p-8`}>
            <h2 className="text-lg font-semibold tracking-tight text-ink-50">典型使用场景</h2>
            <ul className="mt-6 space-y-5">
              {[
                {
                  title: '按次扣减',
                  text: '浏览器插件按真实调用次数扣减 remainingCount，见底即失效。',
                },
                {
                  title: '周期授权',
                  text: '桌面工具首次激活后按有效期持续授权，到期自动失效。',
                },
                {
                  title: '多项目并行',
                  text: '同一服务端同时管理多个产品或客户项目，互不干扰。',
                },
                {
                  title: '链路可查',
                  text: '通过消费日志、趋势图与 requestId 快速回查问题。',
                },
              ].map((item, index) => (
                <li key={item.title} className="flex gap-4">
                  <span className="tabular-nums mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-100 text-xs font-semibold text-ink-500">
                    {index + 1}
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-ink-100">{item.title}</div>
                    <p className="mt-1 text-sm leading-6 text-ink-500">{item.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className={`${publicShellClassName} p-8`}>
            <h2 className="text-lg font-semibold tracking-tight text-ink-50">快速入口</h2>
            <div className="mt-6 space-y-4">
              {[
                {
                  title: '管理后台',
                  description: '项目管理、发码、消费日志与系统配置工作台。',
                  href: '/admin/login',
                  primary: true,
                },
                {
                  title: '公开 API 文档',
                  description: '正式接口、字段规范、SDK 示例与联调方法。',
                  href: '/docs/api',
                  primary: false,
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="flex flex-col gap-4 rounded-lg border border-surface-200 bg-surface-50 p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="text-base font-semibold text-ink-50">{item.title}</div>
                    <p className="mt-1 text-sm leading-6 text-ink-500">{item.description}</p>
                  </div>
                  <Link
                    href={item.href}
                    className={`shrink-0 ${item.primary ? publicPrimaryButtonClassName : publicSecondaryButtonClassName}`}
                  >
                    立即进入
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}