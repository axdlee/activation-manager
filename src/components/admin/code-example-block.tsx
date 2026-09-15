'use client'

import * as React from 'react'
import { Check, ChevronDown, Copy } from 'lucide-react'

import { useI18n } from '@/lib/i18n/i18n-provider'

export type CodeExampleBlockProps = {
  /** 代码块标题（如 cURL / Node.js） */
  title: string
  code: string
  /** 复制到剪贴板的文本；缺省用 code */
  copyText?: string
  /** 默认是否展开（首个示例可默认展开） */
  defaultOpen?: boolean
  onCopy?: (text: string) => void
}

/**
 * 可折叠代码示例块：标题 + 复制按钮 + 等宽代码。
 * 阅读长文档时按需展开，避免示例墙压垮正文。
 */
export function CodeExampleBlock({
  title,
  code,
  copyText,
  defaultOpen = false,
  onCopy,
}: CodeExampleBlockProps) {
  const { t } = useI18n()
  const [copied, setCopied] = React.useState(false)

  const handleCopy = async () => {
    const text = copyText ?? code
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
      onCopy?.(text)
    } catch {
      onCopy?.('')
    }
  }

  return (
    <details
      className="overflow-hidden rounded-lg border bg-card shadow-sm"
      open={defaultOpen}
      data-code-block={title}
    >
      <summary className="flex h-11 cursor-pointer items-center justify-between gap-3 px-4 text-sm font-medium text-foreground select-none">
        <span className="flex min-w-0 items-center gap-1.5">
          <ChevronDown
            className="h-4 w-4 shrink-0 text-muted-foreground transition-transform [[open]>&]:rotate-180"
            aria-hidden
          />
          <span className="truncate">{title}</span>
        </span>
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            void handleCopy()
          }}
          aria-label={`${t('codeBlock.copy', '复制')} ${title}`}
          className="inline-flex h-10 shrink-0 items-center gap-1 rounded-md border border-input bg-background px-2 text-xs font-medium text-foreground shadow-sm transition hover:bg-accent"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden />
          )}
          {copied ? t('codeBlock.copied', '已复制') : t('codeBlock.copy', '复制')}
        </button>
      </summary>
      <pre className="overflow-x-auto border-t bg-muted/40 px-4 py-3 font-mono text-xs leading-6 text-foreground">
        <code>{code}</code>
      </pre>
    </details>
  )
}
