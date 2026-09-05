import {
  publicContainerClassName,
  publicPageClassName,
  publicShellClassName,
} from '@/lib/public-ui'

export default function Loading() {
  return (
    <main className={`${publicPageClassName} flex min-h-screen items-center justify-center`}>
      <div className={publicContainerClassName}>
        <section className={`${publicShellClassName} mx-auto max-w-lg p-8`}>
          <div className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-brand-500" />
            <span className="text-sm font-medium text-ink-400">正在加载…</span>
          </div>
          <div className="mt-6 space-y-3">
            <div className="h-4 w-2/3 animate-pulse rounded bg-surface-200" />
            <div className="h-4 w-full animate-pulse rounded bg-surface-200" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-surface-200" />
          </div>
        </section>
      </div>
    </main>
  )
}
