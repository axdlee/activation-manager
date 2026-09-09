'use client'

import Link from 'next/link'
import { useEffect } from 'react'

import { useI18n } from '@/lib/i18n/i18n-provider'
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
  const { t } = useI18n()

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
            {t('error.500', '500 · 服务器错误')}
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-ink-50">
            {t('error.500title', '服务器出了点问题')}
          </h1>
          <p className="mt-3 text-sm leading-7 text-ink-500">
            {t('error.500desc', '请稍后重试，或联系管理员。')}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={reset} className={publicPrimaryButtonClassName}>
              {t('common.retry', '重试')}
            </button>
            <Link href="/" className={publicSecondaryButtonClassName}>
              {t('error.backHome', '返回首页')}
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
