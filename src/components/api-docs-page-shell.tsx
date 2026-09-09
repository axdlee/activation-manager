'use client'

import React from 'react'

import { ApiDocsPageHero, ApiDocsWorkspace } from '@/components/api-docs-workspace'
import { publicContainerClassName } from '@/lib/public-ui'

export const apiDocsPageClassName =
  'min-h-screen bg-surface-50 px-4 py-6 text-ink-50 sm:px-6 lg:px-8'

export const apiDocsShellClassName =
  'rounded-lg border border-brand-500/20 bg-surface-100 shadow-card'

/** 公开文档页壳：'use client'，客户端词典渲染标题区与工作区 */
export function ApiDocsPageShell() {
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
          <ApiDocsPageHero />
        </section>

        <ApiDocsWorkspace mode="public" />
      </div>
    </main>
  )
}
