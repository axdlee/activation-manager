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
    description: '每个项目都拥有独立的 projectKey、启停状态与发码空间，适合同时服务多个插件或客户。',
  },
  {
    title: '时间卡 + 次数卡',
    description: '同一后台同时支持 TIME / COUNT 两种授权模型，满足订阅制与按次扣费两类业务。',
  },
  {
    title: 'API 接入文档',
    description: '提供调研路径、字段说明、多语言示例与联调后台入口，减少重复沟通成本。',
  },
]

const operationCards = [
  {
    label: '项目工作台',
    value: 'Project',
    description: '统一管理项目标识、描述、启停与接入范围。',
  },
  {
    label: '授权模型',
    value: 'TIME / COUNT',
    description: '支持按时间和按使用次数两种发码策略。',
  },
  {
    label: '对接闭环',
    value: 'Docs + Logs',
    description: '从调研、接入到日志排查形成完整链路。',
  },
]

export default function Home() {
  return (
    <main className={publicPageClassName}>
      <div className={publicContainerClassName}>
        <section className={`${publicShellClassName} relative overflow-hidden p-6 sm:p-8`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.12),transparent_30%)]" />
          <div className="relative grid gap-8 xl:grid-cols-[1.08fr_0.92fr]">
            <div className="max-w-3xl">
              <div className={publicPillClassName}>
                <span className="h-2 w-2 rounded-full bg-sky-500" />
                License Ops Center
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
                激活码管理系统
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-500 sm:text-base">
                面向多项目、多授权模型与插件接入场景打造的一体化后台。你可以在这里发码、查码、看消费趋势，也可以直接把公开
                API 文档发给接入方。
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/admin/login" className={publicPrimaryButtonClassName}>
                  进入管理后台
                </Link>
                <Link href="/docs/api" className={publicSecondaryButtonClassName}>
                  查看 API 文档
                </Link>
              </div>

              <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
                {operationCards.map((item) => (
                  <div key={item.label} className={publicStatCardClassName}>
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

            <div className="grid gap-4">
              {capabilityCards.map((card) => (
                <div key={card.title} className={publicFeatureCardClassName}>
                  <div className="text-lg font-semibold text-slate-900">{card.title}</div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{card.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className={`${publicFeatureCardClassName} p-6 sm:p-7`}>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              典型使用场景
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {[
                '浏览器插件按真实调用次数扣减 remainingCount。',
                '桌面工具首次激活后按有效期持续授权。',
                '同一个服务端同时管理多个产品或客户项目。',
                '通过消费日志、趋势图与 requestId 快速回查问题。',
              ].map((item, index) => (
                <div
                  key={item}
                  className="rounded-[22px] border border-slate-200/80 bg-white/90 px-5 py-4 shadow-[0_18px_48px_-42px_rgba(15,23,42,0.22)]"
                >
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
                    0{index + 1}
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-600">{item}</div>
                </div>
              ))}
            </div>
          </div>

          <div className={`${publicFeatureCardClassName} p-6 sm:p-7`}>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              快速入口
            </h2>
            <div className="mt-5 space-y-4">
              {[
                {
                  title: '管理后台',
                  description: '进入项目管理、发码、消费日志与系统配置工作台。',
                  href: '/admin/login',
                  primary: true,
                },
                {
                  title: '公开 API 文档',
                  description: '查看正式接口、字段规范、SDK 示例与联调方法。',
                  href: '/docs/api',
                  primary: false,
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-[24px] border border-slate-200/80 bg-white/92 p-5 shadow-[0_18px_56px_-42px_rgba(15,23,42,0.22)]"
                >
                  <div className="text-lg font-semibold text-slate-900">{item.title}</div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
                  <Link
                    href={item.href}
                    className={`mt-4 ${item.primary ? publicPrimaryButtonClassName : publicSecondaryButtonClassName}`}
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
