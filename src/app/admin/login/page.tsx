'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import {
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
    <main className={`${publicPageClassName} flex min-h-screen items-center justify-center`}>
      <div className="w-full max-w-md px-4">
        <section className={`${publicShellClassName} animate-fade-in-up p-8`}>
          <div className={publicPillClassName}>
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500/100/100" />
            Admin Access
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-ink-950">管理后台登录</h1>
          <p className="mt-2 text-sm leading-6 text-ink-500">
            登录后进入项目管理、发码、消费日志与系统配置工作台。
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-ink-200">
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
              <label htmlFor="password" className="block text-sm font-medium text-ink-200">
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
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
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

          <div className="mt-8 border-t border-surface-200 pt-6">
            <div className="flex flex-wrap gap-3">
              <Link href="/docs/api" className={publicSecondaryButtonClassName}>
                查看 API 文档
              </Link>
              <Link href="/" className={publicSecondaryButtonClassName}>
                返回首页
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}