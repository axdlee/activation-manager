'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import {
  publicFeatureCardClassName,
  publicInputClassName,
  publicPageClassName,
  publicPillClassName,
  publicPrimaryButtonClassName,
  publicSecondaryButtonClassName,
  publicShellClassName,
} from '@/lib/public-ui'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      })

      const data = await response.json()

      if (data.success) {
        router.push('/admin/dashboard')
      } else {
        setError(data.message || '登录失败')
      }
    } catch (error) {
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className={publicPageClassName}>
      <div className="mx-auto max-w-6xl">
        <section className={`${publicShellClassName} overflow-hidden`}>
          <div className="grid xl:grid-cols-[1fr_0.92fr]">
            <div className="relative overflow-hidden bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(224,231,255,0.86))] p-6 sm:p-8">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.14),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.14),transparent_30%)]" />
              <div className="relative">
                <div className={publicPillClassName}>
                  <span className="h-2 w-2 rounded-full bg-sky-500" />
                  Admin Access
                </div>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                  管理后台登录
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500 sm:text-base">
                  进入项目管理、生成激活码、查看消费日志与系统配置。页面风格已统一为与主后台一致的圆润卡片体系。
                </p>

                <div className="mt-8 space-y-4">
                  {[
                    '项目级隔离：每个项目都有独立的 projectKey 与启停控制。',
                    '双授权模型：时间型授权和次数型授权可同时并存。',
                    '接入文档完备：支持直接把 /docs/api 发给插件开发者与测试同学。',
                  ].map((item) => (
                    <div key={item} className={publicFeatureCardClassName}>
                      <div className="text-sm leading-6 text-slate-600">{item}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href="/docs/api" className={publicSecondaryButtonClassName}>
                    查看 API 文档
                  </Link>
                  <Link href="/" className={publicSecondaryButtonClassName}>
                    返回首页
                  </Link>
                </div>
              </div>
            </div>

            <div className="bg-white/94 p-6 sm:p-8">
              <div className="max-w-md">
                <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-slate-600">
                  管理员凭证
                </div>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
                  使用账号密码登录
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  登录成功后将进入 /admin/dashboard，可继续查看项目、激活码、日志与 API 接入工作区。
                </p>

                <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                  <div>
                    <label
                      htmlFor="username"
                      className="block text-sm font-medium text-slate-700"
                    >
                      用户名
                    </label>
                    <input
                      type="text"
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className={`mt-2 ${publicInputClassName}`}
                      placeholder="请输入管理员用户名"
                      autoComplete="username"
                      required
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium text-slate-700"
                    >
                      密码
                    </label>
                    <input
                      type="password"
                      id="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`mt-2 ${publicInputClassName}`}
                      placeholder="请输入登录密码"
                      autoComplete="current-password"
                      required
                    />
                  </div>

                  {error && (
                    <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className={`w-full ${publicPrimaryButtonClassName}`}
                  >
                    {loading ? '登录中...' : '登录后台'}
                  </button>
                </form>

                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {[
                    {
                      title: '接入文档',
                      description: '先给前端 / 插件方看 /docs/api，再进入后台联调。',
                    },
                    {
                      title: '统一 UI',
                      description: '输入框、按钮与卡片已统一为更圆润的视觉体系。',
                    },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="rounded-[22px] border border-slate-200/80 bg-slate-50/85 px-4 py-4"
                    >
                      <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        {item.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
