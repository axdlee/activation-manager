import Link from 'next/link'

import {
  publicContainerClassName,
  publicPageClassName,
  publicPrimaryButtonClassName,
  publicSecondaryButtonClassName,
  publicShellClassName,
} from '@/lib/public-ui'

export default function NotFound() {
  return (
    <main className={`${publicPageClassName} flex min-h-screen items-center justify-center`}>
      <div className={publicContainerClassName}>
        <section className={`${publicShellClassName} mx-auto max-w-lg p-8 text-center`}>
          <div className="inline-flex items-center gap-2 rounded-sm border border-brand-500/20 bg-brand-500/10 px-2.5 py-1 text-xs font-medium text-brand-400">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
            404 · 页面不存在
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-ink-50">找不到这个页面</h1>
          <p className="mt-3 text-sm leading-7 text-ink-500">
            你访问的地址可能已被移动、改名或从未存在。可以回到首页，或查看公开 API 文档。
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/" className={publicPrimaryButtonClassName}>
              返回首页
            </Link>
            <Link href="/docs/api" className={publicSecondaryButtonClassName}>
              查看 API 文档
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
