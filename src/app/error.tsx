'use client'

import Link from 'next/link'
import { useEffect } from 'react'

import {
  publicContainerClassName,
  publicPageClassName,
  publicPrimaryButtonClassName,
  publicSecondaryButtonClassName,
  publicShellClassName,
} from '@/lib/public-ui'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // 上报错误信息（当前仅控制台，便于排查）
    console.error('全局错误:', error)
  }, [error])

  return (
    <main className={`${publicPageClassName} flex min-h-screen items-center justify-center`}>
      <div className={publicContainerClassName}>
        <section className={`${publicShellClassName} mx-auto max-w-lg p-8 text-center`}>
          <div className="inline-flex items-center gap-2 rounded-sm border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-400">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            500 · 服务异常
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-ink-50">出了点问题</h1>
          <p className="mt-3 text-sm leading-7 text-ink-500">
            页面加载时发生异常，请稍后重试。如果问题持续出现，可以回到首页重新开始。
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={reset} className={publicPrimaryButtonClassName}>
              重试
            </button>
            <Link href="/" className={publicSecondaryButtonClassName}>
              返回首页
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
